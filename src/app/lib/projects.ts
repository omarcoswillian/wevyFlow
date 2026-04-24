"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

export interface ProjectPage {
  id: string;
  name: string;
  code: string;
  platform: "html" | "elementor" | "webflow";
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  pages: ProjectPage[];
  thumbnail: string;
  coverImage: string;
  starred: boolean;
  createdBy: "me" | "shared";
  createdAt: number;
  updatedAt: number;
}

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type PageRow = Database["public"]["Tables"]["project_pages"]["Row"];
type ProjectWithPages = ProjectRow & { project_pages: PageRow[] };

function mapPage(row: PageRow): ProjectPage {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    platform: row.platform,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function mapProject(row: ProjectWithPages): Project {
  return {
    id: row.id,
    name: row.name,
    client: row.client,
    thumbnail: row.thumbnail,
    coverImage: row.cover_image ?? "",
    starred: row.starred,
    createdBy: "me",
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    pages: (row.project_pages || []).map(mapPage),
  };
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const loadProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from("projects")
      .select("*, project_pages(*)")
      .order("updated_at", { ascending: false });

    if (error) {
      setSaveError(error.message);
      return;
    }

    setProjects(((data as ProjectWithPages[]) || []).map(mapProject));
  }, [supabase]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const createProject = useCallback(
    async (name: string, client: string): Promise<Project> => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("projects")
        .insert({ name, client, user_id: user!.id })
        .select("*, project_pages(*)")
        .single();

      if (error) {
        setSaveError(error.message);
        throw error;
      }

      const project = mapProject(data as ProjectWithPages);
      setProjects((prev) => [project, ...prev]);
      return project;
    },
    [supabase]
  );

  const addPageToProject = useCallback(
    async (projectId: string, page: Omit<ProjectPage, "id" | "createdAt" | "updatedAt">) => {
      const { data, error } = await supabase
        .from("project_pages")
        .insert({
          project_id: projectId,
          name: page.name,
          code: page.code,
          platform: page.platform,
        })
        .select()
        .single();

      if (error) {
        setSaveError(error.message);
        return;
      }

      const newPage = mapPage(data);
      const thumbnail = page.code.slice(0, 200);

      await supabase
        .from("projects")
        .update({ thumbnail })
        .eq("id", projectId);

      setProjects((prev) =>
        prev.map((p) =>
          p.id !== projectId
            ? p
            : { ...p, pages: [...p.pages, newPage], thumbnail, updatedAt: Date.now() }
        )
      );
    },
    [supabase]
  );

  const updatePageCode = useCallback(
    async (projectId: string, pageId: string, code: string) => {
      const { error } = await supabase
        .from("project_pages")
        .update({ code })
        .eq("id", pageId);

      if (error) {
        setSaveError(error.message);
        return;
      }

      const thumbnail = code.slice(0, 200);
      await supabase.from("projects").update({ thumbnail }).eq("id", projectId);

      setProjects((prev) =>
        prev.map((p) =>
          p.id !== projectId
            ? p
            : {
                ...p,
                pages: p.pages.map((pg) =>
                  pg.id === pageId ? { ...pg, code, updatedAt: Date.now() } : pg
                ),
                thumbnail,
                updatedAt: Date.now(),
              }
        )
      );
    },
    [supabase]
  );

  const toggleStar = useCallback(
    async (projectId: string) => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;
      const starred = !project.starred;

      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, starred } : p))
      );

      const { error } = await supabase
        .from("projects")
        .update({ starred })
        .eq("id", projectId);

      if (error) {
        setSaveError(error.message);
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, starred: !starred } : p))
        );
      }
    },
    [supabase, projects]
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      setProjects((prev) => prev.filter((p) => p.id !== projectId));

      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId);

      if (error) {
        setSaveError(error.message);
        loadProjects();
      }
    },
    [supabase, loadProjects]
  );

  const deletePageFromProject = useCallback(
    async (projectId: string, pageId: string) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id !== projectId
            ? p
            : { ...p, pages: p.pages.filter((pg) => pg.id !== pageId), updatedAt: Date.now() }
        )
      );

      const { error } = await supabase
        .from("project_pages")
        .delete()
        .eq("id", pageId);

      if (error) {
        setSaveError(error.message);
        loadProjects();
      }
    },
    [supabase, loadProjects]
  );

  const updateCoverImage = useCallback(
    async (projectId: string, file: File) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${projectId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("project-covers")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        setSaveError(uploadError.message);
        throw new Error(uploadError.message);
      }

      const { data: { publicUrl } } = supabase.storage
        .from("project-covers")
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from("projects")
        .update({ cover_image: publicUrl })
        .eq("id", projectId);

      if (updateError) {
        setSaveError(updateError.message);
        throw new Error(updateError.message);
      }

      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, coverImage: publicUrl } : p))
      );
    },
    [supabase]
  );

  return {
    projects,
    saveError,
    createProject,
    addPageToProject,
    updatePageCode,
    toggleStar,
    deleteProject,
    deletePageFromProject,
    updateCoverImage,
  };
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}
