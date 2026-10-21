"use client";

import { useId, useRef } from "react";
import { Download, Package, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { PdfIcon, WordIcon } from "@/components/ui/FileIcons";

/**
 * One "Download" button; it opens a small window where the format is chosen. A native <dialog> gives the focus trap,
 * Escape and focus return. Choosing a format starts the download and closes the window.
 */
export function DownloadDialog({ docLabel, pdfHref, docxHref, variant = "primary", iconOnly = false, zipHref }: { docLabel: string; pdfHref: string; docxHref: string; variant?: "primary" | "secondary"; iconOnly?: boolean; zipHref?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId(); // several of these can be on one page
  const close = () => dialog.current?.close();
  const option = "flex items-center gap-ds-3 rounded-md bg-gray-100 p-ds-3 text-navy-900 no-underline hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-blue-600";
  return (
    <>
      {iconOnly ? (
        <IconButton type="button" tone="blue" label={`Download ${docLabel}`} onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">
          <Download size={18} aria-hidden="true" />
        </IconButton>
      ) : (
        <Button type="button" variant={variant} compact icon={<Download size={16} aria-hidden="true" />} onClick={() => dialog.current?.showModal()} aria-haspopup="dialog" aria-label={`Download ${docLabel}`}>
          Download
        </Button>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
        className="m-auto w-[min(440px,calc(100%-32px))] rounded-md bg-white p-ds-5 text-navy-900 shadow-card backdrop:bg-navy-900/50"
      >
        <div className="flex flex-col gap-ds-4">
          <div className="flex items-start justify-between gap-ds-3">
            <h2 id={titleId} className="text-heading-section">
              Download your {docLabel}
            </h2>
            <button type="button" onClick={close} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full text-navy-900 hover:bg-gray-100">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <p className="text-body-sm">Choose a format.</p>
          <ul className="flex flex-col gap-ds-2">
            <li>
              <a href={pdfHref} onClick={() => setTimeout(close, 0)} className={option}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-blue-600">
                  <PdfIcon size={20} />
                </span>
                <span className="flex flex-col">
                  <span className="text-label-bold">PDF</span>
                  <span className="text-caption">Keeps the layout exactly as you see it.</span>
                </span>
              </a>
            </li>
            <li>
              <a href={docxHref} onClick={() => setTimeout(close, 0)} className={option}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-blue-600">
                  <WordIcon size={20} />
                </span>
                <span className="flex flex-col">
                  <span className="text-label-bold">Word (.docx)</span>
                  <span className="text-caption">Open and change it in Word.</span>
                </span>
              </a>
            </li>
            {zipHref && (
              <li>
                <a href={zipHref} onClick={() => setTimeout(close, 0)} className={option}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-blue-600">
                    <Package size={20} aria-hidden="true" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-label-bold">Resume and cover letter (.zip)</span>
                    <span className="text-caption">Both documents together, as PDF files.</span>
                  </span>
                </a>
              </li>
            )}
          </ul>
        </div>
      </dialog>
    </>
  );
}
