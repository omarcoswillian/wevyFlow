import assert from "node:assert/strict";
import sharp from "sharp";

// Run with: npx jiti scripts/test-person-patch-integrity.ts
import {
  buildPersonPatchMask,
  compositePersonPatch,
  PERSON_PATCH_CONFIG,
  preparePersonPatch,
  type PersonPatchPlan,
  type PersonRegion,
} from "../src/app/api/generate-design/person-patch";

const WIDTH = 512;
const HEIGHT = 512;
const ORIGINAL_RGB = { r: 17, g: 34, b: 51 };
const GENERATED_RGB = { r: 226, g: 72, b: 44 };

function generatedRegionForPlan(plan: PersonPatchPlan): PersonRegion {
  const person = plan.personInContext;
  return {
    bounds: {
      left: person.left / plan.contextCrop.width * 100,
      top: person.top / plan.contextCrop.height * 100,
      right: (person.left + person.width) / plan.contextCrop.width * 100,
      bottom: (person.top + person.height) / plan.contextCrop.height * 100,
    },
    confidence: "high",
  };
}

async function rawRgba(buffer: Buffer) {
  return sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

async function buildPlan(protectedRegion = false, extraContextRatio = 0): Promise<PersonPatchPlan> {
  const original = await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: ORIGINAL_RGB },
  }).png().toBuffer();
  const preparation = await preparePersonPatch(
    original,
    { bounds: { left: 35, top: 20, right: 65, bottom: 80 }, confidence: "high" },
    protectedRegion ? [{ left: 46, top: 42, right: 54, bottom: 50 }] : [],
    protectedRegion,
    { extraContextRatio },
  );
  assert(preparation.plan, preparation.reason);
  return preparation.plan;
}

async function compositeSynthetic(plan: PersonPatchPlan): Promise<Buffer> {
  const generated = await sharp({
    create: {
      width: plan.contextCrop.width,
      height: plan.contextCrop.height,
      channels: 3,
      background: GENERATED_RGB,
    },
  }).png().toBuffer();
  const composite = await compositePersonPatch(plan, generated, generatedRegionForPlan(plan));
  assert(composite.buffer, composite.reason);
  return composite.buffer;
}

async function main() {
  const plan = await buildPlan();
  const output = await compositeSynthetic(plan);
  const [originalRaw, outputRaw] = await Promise.all([rawRgba(plan.original), rawRgba(output)]);
  assert.equal(outputRaw.info.width, plan.fullWidth);
  assert.equal(outputRaw.info.height, plan.fullHeight);

  const mask = buildPersonPatchMask(plan);
  let outsideChangedPixels = 0;
  for (let y = 0; y < plan.fullHeight; y++) {
    for (let x = 0; x < plan.fullWidth; x++) {
      const localX = x - plan.contextCrop.left;
      const localY = y - plan.contextCrop.top;
      const editable = localX >= 0
        && localX < plan.contextCrop.width
        && localY >= 0
        && localY < plan.contextCrop.height
        && mask[localY * plan.contextCrop.width + localX] > 0;
      if (editable) continue;
      const offset = (y * plan.fullWidth + x) * 4;
      if (!originalRaw.data.subarray(offset, offset + 4).equals(outputRaw.data.subarray(offset, offset + 4))) {
        outsideChangedPixels++;
      }
    }
  }
  assert.equal(outsideChangedPixels, 0, "pixels changed outside the allowed person mask");

  const core = plan.personInContext;
  for (let y = core.top; y < core.top + core.height; y++) {
    for (let x = core.left; x < core.left + core.width; x++) {
      const fullX = plan.contextCrop.left + x;
      const fullY = plan.contextCrop.top + y;
      const offset = (fullY * plan.fullWidth + fullX) * 4;
      assert.deepEqual(
        [...outputRaw.data.subarray(offset, offset + 4)],
        [GENERATED_RGB.r, GENERATED_RGB.g, GENERATED_RGB.b, 255],
        `person core was not fully replaced at ${fullX},${fullY}`,
      );
    }
  }

  const shiftedGenerated = await sharp({
    create: {
      width: plan.contextCrop.width,
      height: plan.contextCrop.height,
      channels: 3,
      background: GENERATED_RGB,
    },
  }).png().toBuffer();
  const expected = plan.personInContext;
  const shiftedRegion: PersonRegion = {
    bounds: {
      left: (expected.left + expected.width * 0.10) / plan.contextCrop.width * 100,
      top: (expected.top + expected.height * 0.08) / plan.contextCrop.height * 100,
      right: (expected.left + expected.width * 1.25) / plan.contextCrop.width * 100,
      bottom: (expected.top + expected.height * 0.98) / plan.contextCrop.height * 100,
    },
    confidence: "medium",
  };
  const alignedComposite = await compositePersonPatch(plan, shiftedGenerated, shiftedRegion);
  assert(alignedComposite.buffer, alignedComposite.reason);
  assert(
    alignedComposite.diagnostics.alignedIou >= PERSON_PATCH_CONFIG.MIN_RESIDUAL_IOU,
    "auto-alignment did not restore expected person geometry",
  );

  const protectedPlan = await buildPlan(true);
  const protectedOutput = await compositeSynthetic(protectedPlan);
  const [protectedOriginalRaw, protectedOutputRaw] = await Promise.all([
    rawRgba(protectedPlan.original),
    rawRgba(protectedOutput),
  ]);
  for (const rect of protectedPlan.protectedInContext) {
    for (let y = rect.top; y < rect.top + rect.height; y++) {
      for (let x = rect.left; x < rect.left + rect.width; x++) {
        const fullX = protectedPlan.contextCrop.left + x;
        const fullY = protectedPlan.contextCrop.top + y;
        const offset = (fullY * protectedPlan.fullWidth + fullX) * 4;
        assert(
          protectedOriginalRaw.data.subarray(offset, offset + 4)
            .equals(protectedOutputRaw.data.subarray(offset, offset + 4)),
          `protected pixels were not restored at ${fullX},${fullY}`,
        );
      }
    }
  }

  console.log("person-patch integrity: PASS");
  console.log(`outside-mask changed pixels: ${outsideChangedPixels}`);
  console.log("person core: fully replaced");
  console.log(`auto-align residual IoU: ${alignedComposite.diagnostics.alignedIou.toFixed(3)}`);
  console.log("overlapping protected region: restored exactly");
}

main().catch(error => {
  console.error("person-patch integrity: FAIL", error);
  process.exitCode = 1;
});
