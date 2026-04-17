"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  X,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Info,
  Download,
  FileJson,
} from "lucide-react";

interface ElementorExportProps {
  code: string;
  onClose: () => void;
}

interface HtmlSection {
  id: string;
  label: string;
  tag: string;
  html: string;
  preview: string;
}

function extractStyles(html: string): string {
  const styles: string[] = [];
  // Extract all <style> tags
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    styles.push(match[1]);
  }
  // Extract <link> tags for fonts
  const linkRegex = /<link[^>]*href="[^"]*font[^"]*"[^>]*>/gi;
  const links: string[] = [];
  while ((match = linkRegex.exec(html)) !== null) {
    links.push(match[0]);
  }
  // Extract <link> for preconnect
  const preconnectRegex = /<link[^>]*rel="preconnect"[^>]*>/gi;
  while ((match = preconnectRegex.exec(html)) !== null) {
    links.push(match[0]);
  }

  const fontLinks = links.length > 0 ? links.join("\n") + "\n" : "";
  const cssContent = styles.join("\n\n");

  return fontLinks + (cssContent ? `<style>\n${cssContent}\n</style>` : "");
}

function extractScripts(html: string): string {
  const scripts: string[] = [];
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    scripts.push(match[1].trim());
  }
  return scripts.length > 0 ? `<script>\n${scripts.join("\n\n")}\n</script>` : "";
}

function splitIntoSections(html: string): HtmlSection[] {
  // Get body content
  let body = html;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) body = bodyMatch[1];

  // Strip styles, scripts, links (they go in shared CSS/JS)
  body = body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  body = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  body = body.replace(/<link[^>]*>/gi, "");
  body = body.trim();

  const sections: HtmlSection[] = [];
  let counter = 0;

  const addSection = (h: string, tag: string, label: string) => {
    const trimmed = h.trim();
    if (!trimmed || trimmed.length < 10) return;
    counter++;
    sections.push({
      id: `s${counter}`,
      label,
      tag,
      html: trimmed,
      preview: trimmed.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120),
    });
  };

  // ── Step 1: Find urgency bar (before shell) ──
  const urgencyMatch = body.match(/<div class="urgency[^"]*"[^>]*>[\s\S]*?<\/div>/i);
  if (urgencyMatch) addSection(urgencyMatch[0], "urgency", "Barra de Urgencia");

  // ── Step 2: Find all top-level blocks inside shell ──
  // Use depth tracking to correctly match nested tags
  const shellIdx = body.indexOf('<div class="shell">');
  if (shellIdx !== -1) {
    const shellStart = shellIdx + '<div class="shell">'.length;
    // Find matching closing </div> for shell
    let depth = 1;
    let i = shellStart;
    while (i < body.length && depth > 0) {
      if (body.substring(i, i + 4) === "<div") depth++;
      if (body.substring(i, i + 6) === "</div>") depth--;
      if (depth > 0) i++;
      else break;
    }
    const shellContent = body.substring(shellStart, i);

    // Extract top-level blocks: <section class="block..."> or <footer class="block...">
    // Use depth tracking, not regex
    const blockStarts: number[] = [];
    const blockEnds: number[] = [];
    const blockPattern = /(<(?:section|footer)\s+class="block[^"]*"[^>]*>)/gi;
    let bm;
    while ((bm = blockPattern.exec(shellContent)) !== null) {
      const startPos = bm.index;
      const tag = shellContent[startPos + 1] === 'f' || shellContent[startPos + 1] === 'F' ? 'footer' : 'section';
      // Find the matching closing tag by depth
      let d = 1;
      let p = startPos + bm[0].length;
      const openRe = new RegExp(`<${tag}[\\s>]`, 'gi');
      const closeTag = `</${tag}>`;
      while (p < shellContent.length && d > 0) {
        // Check for closing tag
        if (shellContent.substring(p, p + closeTag.length).toLowerCase() === closeTag) {
          d--;
          if (d === 0) {
            blockStarts.push(startPos);
            blockEnds.push(p + closeTag.length);
            break;
          }
          p += closeTag.length;
        }
        // Check for opening tag (nested)
        else if (shellContent.substring(p).match(new RegExp(`^<${tag}[\\s>]`, 'i'))) {
          d++;
          p++;
        } else {
          p++;
        }
      }
    }

    // Deduplicate: remove any block that starts inside another block
    const validBlocks: { start: number; end: number }[] = [];
    for (let b = 0; b < blockStarts.length; b++) {
      const isNested = validBlocks.some(v => blockStarts[b] > v.start && blockStarts[b] < v.end);
      if (!isNested) validBlocks.push({ start: blockStarts[b], end: blockEnds[b] });
    }

    for (const block of validBlocks) {
      const blockHtml = shellContent.substring(block.start, block.end);
      const tag = classifySection(blockHtml);
      const label = labelSection(blockHtml, tag, counter + 1);
      addSection(blockHtml, tag, label);
    }
  } else {
    // No shell wrapper — split by top-level section/footer/div elements using depth tracking
    const lines = body.split("\n");
    let current = "";
    let d = 0;
    for (const line of lines) {
      const opens = (line.match(/<(?:section|footer|header|div)\s/gi) || []).length;
      const closes = (line.match(/<\/(?:section|footer|header|div)>/gi) || []).length;
      current += line + "\n";
      d += opens - closes;
      if (d <= 0 && current.trim().length > 20) {
        const tag = classifySection(current);
        addSection(current, tag, labelSection(current, tag, counter + 1));
        current = "";
        d = 0;
      }
    }
    if (current.trim().length > 20) {
      addSection(current, "section", `Secao ${counter + 1}`);
    }
  }

  // ── Step 3: Find sticky mobile CTA (after shell) ──
  const smcMatch = body.match(/<div class="smc"[^>]*>[\s\S]*?<\/div>/i);
  if (smcMatch) addSection(smcMatch[0], "sticky-cta", "CTA Mobile Fixo");

  // Fallback: entire body as one section
  if (sections.length === 0 && body.length > 0) {
    addSection(body, "section", "Pagina Completa");
  }

  return sections;
}

// Classify a section by looking at CSS classes and content inside it
function classifySection(html: string): string {
  const l = html.toLowerCase();
  // Check specific CSS class names that appear INSIDE the section
  if (l.includes('class="hero"') || l.includes('class="hero ') || l.includes('class="wf-hero')) return "hero";
  if (l.includes('class="urgency') || l.includes('class="wf-urgency')) return "urgency";
  if (l.includes("<footer")) return "footer";
  if (l.includes("faq-grid") || l.includes("faq-list") || l.includes("wf-faq")) return "faq";
  if (l.includes("price-card") || l.includes("price-section") || l.includes("wf-price")) return "pricing";
  if (l.includes("tst-hero-grid") || l.includes("tst-img") || l.includes("wf-tst")) return "testimonials";
  if (l.includes("bonus-grid") || l.includes("bonus-card") || l.includes("wf-bonus")) return "bonus";
  if (l.includes("mentors-media") || l.includes("mentors-text") || l.includes("wf-mentors")) return "mentor";
  if (l.includes("manifesto-text") || l.includes("manifesto-inner") || l.includes("wf-manifesto")) return "manifesto";
  if (l.includes("steps-hero-grid") || l.includes('class="step"') || l.includes('class="step ') || l.includes("wf-step")) return "steps";
  if (l.includes("split-media") || l.includes("split-text") || l.includes("wf-split")) return "split";
  if (l.includes("<h1")) return "hero";
  return "section";
}

// Generate a human label for the section
function labelSection(html: string, tag: string, index: number): string {
  const labels: Record<string, string> = {
    hero: "Hero",
    urgency: "Barra de Urgencia",
    footer: "Footer",
    faq: "FAQ",
    pricing: "Preco / Oferta",
    testimonials: "Depoimentos",
    bonus: "Bonus",
    mentor: "Mentor / Criador",
    manifesto: "Manifesto",
    steps: "Metodo / Steps",
    split: "Oportunidade",
    "sticky-cta": "CTA Mobile Fixo",
  };
  if (labels[tag]) return labels[tag];

  // Try h2
  const h2 = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (h2) {
    const text = h2[1].replace(/<[^>]*>/g, "").trim().slice(0, 40);
    if (text) return text;
  }
  return `Secao ${index}`;
}

// ============ ELEMENTOR JSON GENERATOR (Native Plugin Widgets) ============

let idCounter = 0;
function genId(): string {
  idCounter++;
  return (Date.now().toString(16).slice(-4) + idCounter.toString(16).padStart(4, "0"));
}

function strip(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&rarr;/g, "→").replace(/&copy;/g, "©").trim();
}

function extractFirst(html: string, tag: string): string {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

function extractAll(html: string, tag: string): string[] {
  const r: string[] = [];
  let m;
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  while ((m = re.exec(html)) !== null) r.push(m[1].trim());
  return r;
}

function nativeWidget(widgetType: string, settings: Record<string, any>): any {
  return { id: genId(), elType: "widget", widgetType, isInner: false, settings, elements: [] };
}

function wrapContainer(children: any[]): any {
  return { id: genId(), elType: "container", isInner: false, settings: { content_width: "full" }, elements: children };
}

// Parse urgency bar → wf-urgency-bar widget
function parseUrgency(html: string): any {
  const strong = strip(extractFirst(html, "strong"));
  const full = strip(html);
  const after = full.replace(strong, "").trim();
  return nativeWidget("wf-urgency-bar", { text_before: strong, text_after: after, bg_color: "#b8132a" });
}

// Parse hero → wf-hero-vsl widget
function parseHero(html: string): any {
  const badge = strip(html.match(/class="hero-badge"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "");
  const h1 = strip(extractFirst(html, "h1"));
  const highlight = strip(html.match(/class="pix-word"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "PIX");
  const sub = strip(html.match(/class="hero-sub"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
  const ctaM = html.match(/<a[^>]*class="[^"]*btn[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
  const ctaText = ctaM ? strip(ctaM[1]) : "Quero entrar";
  const ctaUrl = html.match(/<a[^>]*href="([^"]*)"[^>]*class="[^"]*btn/i)?.[1] || "#checkout";
  return nativeWidget("wf-hero-vsl", {
    badge, headline: h1, highlight_word: highlight, subtitle: sub,
    show_video: "yes", video_embed: "", cta_text: ctaText.replace("→", "").trim(),
    cta_url: { url: ctaUrl, is_external: "", nofollow: "" },
    bg_color_1: "#1c0d22", bg_color_2: "#17091c", text_color: "#f0e8f2",
    highlight_color: "#d4b8dc", cta_color: "#1db954",
  });
}

// Parse split section → wf-split-section widget
function parseSplit(html: string): any {
  const numM = html.match(/class="t-num"[^>]*>([\s\S]*?)<\/span>/i);
  const num = numM ? strip(numM[1]) : "01";
  const labelM = html.match(/class="t-label"[^>]*>([\s\S]*?)<\/div>/i);
  const label = labelM ? strip(labelM[1]).replace(num, "").trim() : "";
  const h2 = strip(extractFirst(html, "h2"));
  const emM = html.match(/<h2[^>]*>[\s\S]*?<em>([\s\S]*?)<\/em>/i);
  const highlight = emM ? strip(emM[1]) : "";
  // Only extract <p> tags that are INSIDE split-text, not inside placeholders
  const splitTextM = html.match(/class="split-text"[^>]*>([\s\S]*?)(?:<\/div>\s*<\/div>)/i);
  const textHtml = splitTextM ? splitTextM[1] : "";
  const ps = extractAll(textHtml, "p").map(strip).filter(p => p.length > 20 && !p.includes("webp") && !p.includes("placeholder"));
  const dark = html.includes("block--dark");
  return nativeWidget("wf-split-section", {
    number: num, label, heading: h2, heading_highlight: highlight,
    paragraph_1: ps[0] || "", paragraph_2: ps[1] || "",
    image: { url: "", id: "" }, reverse: "", dark_mode: dark ? "yes" : "",
  });
}

// Parse manifesto → wf-manifesto widget
function parseManifesto(html: string): any {
  const labelM = html.match(/class="manifesto-label"[^>]*>([\s\S]*?)<\/div>/i);
  const label = labelM ? strip(labelM[1]) : "Filosofia";
  const text = strip(html.match(/class="manifesto-text"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
  const ems = extractAll(html, "em").map(strip);
  const sign = strip(html.match(/class="manifesto-sign"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
  const dark = html.includes("block--dark");
  return nativeWidget("wf-manifesto", {
    label, text, text_highlight: ems.join("|"), signature: sign, dark_mode: dark ? "yes" : "",
  });
}

// Parse steps → wf-steps-grid widget
function parseSteps(html: string): any {
  const numM = html.match(/class="t-num"[^>]*>([\s\S]*?)<\/span>/i);
  const num = numM ? strip(numM[1]) : "02";
  const labelM = html.match(/class="t-label"[^>]*>([\s\S]*?)<\/div>/i);
  const label = labelM ? strip(labelM[1]).replace(num, "").trim() : "O metodo";
  const h2 = strip(html.match(/<h2 class="t-h2">([\s\S]*?)<\/h2>/i)?.[1] || "");
  const subtitle = strip(html.match(/class="t-body"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
  const dark = html.includes("block--dark");

  // Parse individual steps — match each step div properly (exclude steps-hero-grid)
  const steps: { tag: string; title: string; description: string; is_hero: string }[] = [];
  const stepPattern = /<div class="step(| step--hero)">/gi;
  let stepM;
  const positions: { pos: number; isHero: boolean }[] = [];
  while ((stepM = stepPattern.exec(html)) !== null) {
    positions.push({ pos: stepM.index, isHero: stepM[1].includes("--hero") });
  }
  for (let si = 0; si < positions.length; si++) {
    const start = positions[si].pos;
    const end = si + 1 < positions.length ? positions[si + 1].pos : html.length;
    const block = html.substring(start, end);
    const tag = strip(block.match(/<span class="step-tag">([\s\S]*?)<\/span>/i)?.[1] || "");
    const title = strip(extractFirst(block, "h3"));
    const desc = strip(extractFirst(block, "p"));
    if (title) steps.push({ tag, title, description: desc, is_hero: positions[si].isHero ? "yes" : "" });
  }

  return nativeWidget("wf-steps-grid", {
    number: num, label, heading: h2, subtitle, dark_mode: dark ? "yes" : "",
    steps: steps.length > 0 ? steps : [
      { tag: "Passo 01", title: "Passo 1", description: "Descricao.", is_hero: "" },
    ],
  });
}

// Parse testimonials → wf-testimonials-grid widget
function parseTestimonials(html: string): any {
  const numM = html.match(/class="t-num"[^>]*>([\s\S]*?)<\/span>/i);
  const num = numM ? strip(numM[1]) : "03";
  const labelM = html.match(/class="t-label"[^>]*>([\s\S]*?)<\/div>/i);
  const label = labelM ? strip(labelM[1]).replace(num, "").trim() : "Depoimentos";
  const h2 = strip(html.match(/<h2 class="t-h2">([\s\S]*?)<\/h2>/i)?.[1] || "");
  const subtitle = strip(html.match(/class="t-body"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "");
  const dark = html.includes("block--dark");
  // Count actual tst-img divs (not class references in CSS)
  const imgCount = (html.match(/class="tst-img/gi) || []).length;
  const testimonials = Array.from({ length: imgCount || 5 }, (_, i) => ({
    image: { url: "", id: "" }, is_hero: i === 0 ? "yes" : "",
  }));
  return nativeWidget("wf-testimonials-grid", {
    number: num, label, heading: h2, subtitle, dark_mode: dark ? "yes" : "", testimonials,
  });
}

// Parse bonus → wf-bonus-grid widget
function parseBonus(html: string): any {
  const numM = html.match(/class="t-num"[^>]*>([\s\S]*?)<\/span>/i);
  const num = numM ? strip(numM[1]) : "04";
  const labelM = html.match(/class="t-label"[^>]*>([\s\S]*?)<\/div>/i);
  const label = labelM ? strip(labelM[1]).replace(num, "").trim() : "Bonus exclusivos";
  const h2 = strip(html.match(/<h2 class="t-h2">([\s\S]*?)<\/h2>/i)?.[1] || "");
  const dark = html.includes("block--dark");

  // Extract only from bonus-grid div
  const bonusGridM = html.match(/class="bonus-grid[^"]*"[^>]*>([\s\S]*?)(?:<\/div>\s*<\/div>\s*<\/section>)/i);
  const bonusGridHtml = bonusGridM ? bonusGridM[1] : html;
  const h3s = extractAll(bonusGridHtml, "h3").map(strip);
  const bonusPs = extractAll(bonusGridHtml, "p").map(strip).filter(p => p.length > 10);
  const bonusValues = [...bonusGridHtml.matchAll(/class="bonus-value"[^>]*>([\s\S]*?)<\/span>/gi)].map(m => strip(m[1]));
  const bonuses = h3s.map((title, i) => ({
    title,
    description: bonusPs[i] || "",
    value: bonusValues[i] || "R$ 0",
  })).filter(b => b.title);

  return nativeWidget("wf-bonus-grid", {
    number: num, label, heading: h2, dark_mode: dark ? "yes" : "",
    bonuses: bonuses.length > 0 ? bonuses : [{ title: "Bonus", description: "Descricao.", value: "R$ 297" }],
  });
}

// Parse pricing → wf-pricing-card widget
function parsePricing(html: string): any {
  const h2 = strip(html.match(/<h2 class="t-h2">([\s\S]*?)<\/h2>/i)?.[1] || "Investimento");
  const badge = strip(html.match(/class="price-badge"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "Oferta especial");
  const cardTitle = strip(html.match(/class="price-title"[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || "");
  const dark = html.includes("block--dark");

  const items: { text: string; value: string }[] = [];
  const lis = html.match(/<li>[\s\S]*?<\/li>/gi) || [];
  lis.forEach(li => {
    const text = strip(li.match(/class="price-list-text"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "");
    const value = strip(li.match(/class="price-list-value"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "");
    if (text) items.push({ text, value });
  });

  const origPrice = strip(html.match(/class="strike"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "R$ 2.488,00");
  const price = strip(html.match(/class="price-main"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "R$ 497");
  const installments = strip(html.match(/class="price-alt"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || "").replace("ou ", "").replace(" no cartao", "");
  const ctaText = strip(html.match(/<a[^>]*class="[^"]*price-cta[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1] || "Garantir vaga").replace("→", "").trim();
  const ctaUrl = html.match(/<a[^>]*href="([^"]*)"[^>]*class="[^"]*price-cta/i)?.[1] || "#";

  // Seals
  const sealLabels = (html.match(/class="seal-label"[^>]*>([\s\S]*?)<\/span>/gi) || []).map(s => strip(s));

  return nativeWidget("wf-pricing-card", {
    heading: h2, dark_mode: dark ? "yes" : "", badge, card_title: cardTitle,
    items: items.length > 0 ? items : [{ text: "Item", value: "R$ 0" }],
    original_price: origPrice, price, installments,
    cta_text: ctaText, cta_url: { url: ctaUrl, is_external: "", nofollow: "" },
    seal_1: sealLabels[0] || "Pagamento seguro",
    seal_2: sealLabels[1] || "Garantia 7 dias",
    seal_3: sealLabels[2] || "Acesso imediato",
  });
}

// Parse mentor → wf-mentor-section widget
function parseMentor(html: string): any {
  const labelM = html.match(/class="t-label"[^>]*>([\s\S]*?)<\/div>/i);
  const label = labelM ? strip(labelM[1]) : "Quem criou";
  const h2 = strip(extractFirst(html, "h2"));
  const emM = html.match(/<h2[^>]*>[\s\S]*?<em>([\s\S]*?)<\/em>/i);
  const highlight = emM ? strip(emM[1]) : "";
  const numbers = strip(html.match(/class="mentors-numbers"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "");
  // Only extract <p> from mentors-text, NOT from placeholder
  const mentorTextM = html.match(/class="mentors-text"[^>]*>([\s\S]*?)(?:<div class="mentors-sig|$)/i);
  const mentorTextHtml = mentorTextM ? mentorTextM[1] : "";
  const ps = extractAll(mentorTextHtml, "p").map(strip).filter(p =>
    p.length > 20 && !p.includes("webp") && !p.includes("mentor") && !p.includes("Foto do") && !p.includes("placeholder")
  );
  const sig = strip(html.match(/class="mentors-sig[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    html.match(/class="mentors-signature"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "");
  const dark = html.includes("block--dark");
  return nativeWidget("wf-mentor-section", {
    label, heading: h2, heading_highlight: highlight, numbers,
    bio_1: ps[0] || "", bio_2: ps[1] || "", signature: sig,
    photo: { url: "", id: "" }, dark_mode: dark ? "yes" : "",
  });
}

// Parse FAQ → wf-faq-accordion widget
function parseFaq(html: string): any {
  const h2 = strip(html.match(/<h2 class="t-h2">([\s\S]*?)<\/h2>/i)?.[1] || "Perguntas frequentes");
  const subtitle = strip(html.match(/class="faq-head"[\s\S]*?<p>([\s\S]*?)<\/p>/i)?.[1] || "");
  const dark = html.includes("block--dark");

  const faqItems = html.match(/<div class="faq-item">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi) || [];
  const faqs = faqItems.map(item => {
    const q = strip(item.match(/<button class="faq-q">([\s\S]*?)<span/i)?.[1] || "");
    const a = strip(item.match(/class="faq-a-inner"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "");
    return { question: q, answer: a };
  }).filter(f => f.question);

  return nativeWidget("wf-faq-accordion", {
    heading: h2, subtitle, dark_mode: dark ? "yes" : "",
    faqs: faqs.length > 0 ? faqs : [{ question: "Pergunta?", answer: "Resposta." }],
  });
}

// Parse footer → wf-footer-minimal widget
function parseFooter(html: string): any {
  const brand = strip(html.match(/class="logo"[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "");
  const copy = strip(html).replace(brand, "").replace("Termos de uso", "").replace("Politica de privacidade", "").replace("©", "").trim();
  return nativeWidget("wf-footer-minimal", {
    brand, copyright: copy,
    terms_url: { url: "#", is_external: "", nofollow: "" },
    privacy_url: { url: "#", is_external: "", nofollow: "" },
  });
}

// Map section tag → parser
function sectionToWidget(section: HtmlSection): any {
  const { tag, html } = section;
  switch (tag) {
    case "urgency": return parseUrgency(html);
    case "hero": return parseHero(html);
    case "split": return parseSplit(html);
    case "manifesto": return parseManifesto(html);
    case "steps": return parseSteps(html);
    case "testimonials": return parseTestimonials(html);
    case "bonus": return parseBonus(html);
    case "pricing": return parsePricing(html);
    case "mentor": return parseMentor(html);
    case "faq": return parseFaq(html);
    case "footer": return parseFooter(html);
    case "sticky-cta": return nativeWidget("html", { html });
    default: return nativeWidget("html", { html });
  }
}

function generateElementorJson(
  sections: HtmlSection[],
  sharedCss: string,
  sharedJs: string,
  title: string,
): object {
  // Each section → Container > HTML Widget (100% fidelity)
  // First section includes CSS, last includes JS
  const content = sections.map((section, index) => {
    const isFirst = index === 0;
    const isLast = index === sections.length - 1;
    const parts: string[] = [];
    if (isFirst && sharedCss) parts.push(sharedCss);
    // Wrap in shell div to preserve border-radius and spacing
    parts.push(`<div class="shell" style="padding:14px;background:#d4ced6;">${section.html}</div>`);
    if (isLast && sharedJs) parts.push(sharedJs);

    return wrapContainer([nativeWidget("html", { html: parts.join("\n\n") })]);
  });

  return {
    content,
    page_settings: [],
    version: "0.4",
    title,
    type: "page",
  };
}

export function ElementorExport({ code, onClose }: ElementorExportProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [mode, setMode] = useState<"html" | "json">("json");

  const fullHtml = code.includes("<!DOCTYPE") || code.includes("<html") ? code : `<!DOCTYPE html><html><head></head><body>${code}</body></html>`;

  const sharedCss = useMemo(() => extractStyles(fullHtml), [fullHtml]);
  const sharedJs = useMemo(() => extractScripts(fullHtml), [fullHtml]);
  const sections = useMemo(() => splitIntoSections(fullHtml), [fullHtml]);

  const buildSectionCode = useCallback((section: HtmlSection, includeCSS: boolean) => {
    const parts: string[] = [];
    if (includeCSS && sharedCss) parts.push(sharedCss);
    // Wrap in shell div to preserve border-radius and spacing
    parts.push(`<div class="shell" style="padding:14px;background:#d4ced6;">${section.html}</div>`);
    return parts.join("\n\n");
  }, [sharedCss]);

  const handleCopySection = useCallback((section: HtmlSection, withCss: boolean) => {
    const code = buildSectionCode(section, withCss);
    navigator.clipboard.writeText(code);
    setCopiedId(section.id + (withCss ? "-css" : ""));
    setTimeout(() => setCopiedId(null), 2000);
  }, [buildSectionCode]);

  const handleCopyCssOnly = useCallback(() => {
    navigator.clipboard.writeText(sharedCss);
    setCopiedId("css-only");
    setTimeout(() => setCopiedId(null), 2000);
  }, [sharedCss]);

  const handleCopyJsOnly = useCallback(() => {
    navigator.clipboard.writeText(sharedJs);
    setCopiedId("js-only");
    setTimeout(() => setCopiedId(null), 2000);
  }, [sharedJs]);

  const handleCopyAll = useCallback(() => {
    // Build all sections as separate blocks with instructions
    const blocks = sections.map((s, i) => {
      return `<!-- ====== WIDGET HTML ${i + 1}: ${s.label} ====== -->\n${i === 0 ? sharedCss + "\n\n" : ""}${s.html}${i === sections.length - 1 && sharedJs ? "\n\n" + sharedJs : ""}`;
    });
    navigator.clipboard.writeText(blocks.join("\n\n\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [sections, sharedCss, sharedJs]);

  const handleDownloadJson = useCallback(() => {
    idCounter = 0;
    const json = generateElementorJson(sections, sharedCss, sharedJs, "WavyFlow Template");
    const blob = new Blob([JSON.stringify(json)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wavyflow-elementor-template.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [sections, sharedCss, sharedJs]);

  const [jsonCopied, setJsonCopied] = useState(false);
  const handleCopyJson = useCallback(() => {
    idCounter = 0;
    const json = generateElementorJson(sections, sharedCss, sharedJs, "WavyFlow Template");
    navigator.clipboard.writeText(JSON.stringify(json));
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 3000);
  }, [sections, sharedCss, sharedJs]);

  return (
    <>
      <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-[301] flex items-center justify-center p-6 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[440px] rounded-2xl bg-[#18181c] border border-white/[0.08] shadow-2xl shadow-black/60 overflow-hidden animate-slide-up">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5 text-orange-400" />
              </div>
              <h2 className="text-[13px] font-semibold text-white">Exportar para Elementor</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-5 space-y-4">
            {/* Main action: Download JSON */}
            <button
              onClick={() => { handleDownloadJson(); }}
              className="flex items-center justify-center gap-2.5 w-full px-5 py-4 rounded-xl text-[14px] font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg hover:shadow-emerald-500/25 transition-all cursor-pointer"
            >
              <Download className="w-4.5 h-4.5" />
              Baixar template .json
            </button>

            {/* Instructions */}
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] px-4 py-3.5 space-y-2">
              <p className="text-[10px] text-white/30 font-medium">Depois de baixar:</p>
              <div className="text-[11px] text-white/45 space-y-1.5 leading-relaxed">
                <p>1. No Elementor, clique na <strong className="text-white/70">pasta de templates</strong> (icone no painel)</p>
                <p>2. Aba <strong className="text-white/70">Modelos</strong> &gt; clique no icone de <strong className="text-white/70">importar</strong> (seta pra cima)</p>
                <p>3. Selecione o .json e clique <strong className="text-white/70">Inserir</strong></p>
              </div>
            </div>

            {/* Section count */}
            <p className="text-[9px] text-white/15 text-center">{sections.length} secoes · Fidelidade 100% ao layout do WavyFlow</p>

            {/* Alternative: Copy for WP plugin */}
            <div className="pt-2 border-t border-white/[0.04]">
              <button
                onClick={handleCopyJson}
                className={cn("flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
                  jsonCopied
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-white/25 hover:text-white/40 hover:bg-white/[0.03]")}
              >
                {jsonCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {jsonCopied ? "Copiado! Cole no WP > WavyFlow" : "Ou copiar para plugin WordPress"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
