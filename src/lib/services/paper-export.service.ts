import type { AuthContext } from "@/lib/auth/session";
import { paperService } from "@/lib/services/paper.service";
import { auditService, type AuditContext } from "@/lib/services/audit.service";
import { buildRenderedPaper } from "@/lib/export/paper-document";
import { renderPaperPdf } from "@/lib/export/pdf";
import { renderPaperDocx } from "@/lib/export/docx";
import type { ExportFormat, ExportVariant } from "@/types/paper";
import type { PaperDesignInput } from "@/lib/validation/paper.schema";

/**
 * Export orchestration.
 *
 * Access is authorized by the organization-scoped paper read in paperService.
 * Anyone who can view that paper can generate either copy; the variant controls
 * whether the authorized paper's answer data is included.
 */

export interface ExportResult {
  body: Uint8Array;
  filename: string;
  contentType: string;
  degraded: boolean;
}

const CONTENT_TYPES: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function safeFilename(title: string, variant: ExportVariant, format: ExportFormat): string {
  const base = title
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60)
    .toLowerCase();

  return `${base || "question-paper"}-${variant}.${format}`;
}

export const paperExportService = {
  async export(
    id: string,
    actor: AuthContext,
    options: { format: ExportFormat; variant: ExportVariant; designConfig?: PaperDesignInput },
    context: AuditContext,
  ): Promise<ExportResult> {
    const paper = await paperService.getById(id, actor, {
      withAnswers: options.variant === "teacher",
      includeCopyAnswers: options.variant === "teacher",
    });

    const rendered = buildRenderedPaper(
      paper,
      options.variant,
      options.format === "pdf" ? options.designConfig : undefined,
    );

    let body: Uint8Array;
    let degraded = false;

    if (options.format === "pdf") {
      const result = await renderPaperPdf(rendered);
      body = result.bytes;
      degraded = result.degraded;
    } else {
      body = new Uint8Array(await renderPaperDocx(rendered));
    }

    await auditService.record(
      {
        action: "paper.export",
        resourceType: "paper",
        resourceId: id,
        metadata: {
          format: options.format,
          variant: options.variant,
          questions: rendered.totalQuestions,
        },
      },
      context,
    );

    return {
      body,
      degraded,
      filename: safeFilename(paper.title, options.variant, options.format),
      contentType: CONTENT_TYPES[options.format],
    };
  },
};

export type PaperExportService = typeof paperExportService;
