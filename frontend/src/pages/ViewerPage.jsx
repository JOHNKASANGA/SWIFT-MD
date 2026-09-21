import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ViewerPage() {
  const { materialId } = useParams();
  const navigate = useNavigate();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchMaterial() {
      const { data, error: materialError } = await supabase
        .from("materials")
        .select("*")
        .eq("id", materialId)
        .single();

      if (materialError || !data) {
        setError("This material could not be opened.");
      } else {
        setMaterial(data);
      }

      setLoading(false);
    }

    fetchMaterial();
  }, [materialId]);

  function getViewerUrl(fileUrl) {
    if (!fileUrl) return null;

    const driveFileMatch =
      fileUrl.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      fileUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);

    if (driveFileMatch) {
      return `https://drive.google.com/file/d/${driveFileMatch[1]}/preview`;
    }

    const presentationMatch = fileUrl.match(
      /docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/
    );

    if (presentationMatch) {
      return `https://docs.google.com/presentation/d/${presentationMatch[1]}/embed`;
    }

    const documentMatch = fileUrl.match(
      /docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/
    );

    if (documentMatch) {
      return `https://docs.google.com/document/d/${documentMatch[1]}/preview`;
    }

    return null;
  }

  function isMediaFire(fileUrl) {
    return fileUrl?.includes("mediafire.com");
  }

  if (loading) {
    return (
      <div className="swift-loading-screen">
        <span className="swift-loading-mark">S</span>
        <p>Opening material...</p>
      </div>
    );
  }

  if (error || !material) {
    return (
      <div className="viewer-page viewer-empty-state">
        <button
          type="button"
          className="swift-back-button"
          onClick={() => navigate(-1)}
        >
          <span aria-hidden="true">←</span> Back
        </button>
        <p>{error || "Material not found."}</p>
      </div>
    );
  }

  const viewerUrl = getViewerUrl(material.file_url);
  const mediafire = isMediaFire(material.file_url);

  return (
    <div className="viewer-page">
      <header className="viewer-header">
        <div className="viewer-header-main">
          <button
            type="button"
            className="swift-brand"
            onClick={() => navigate("/home")}
            aria-label="Go to Swift home"
          >
            <span className="swift-brand-mark">S</span>
            <span>Swift</span>
          </button>

          <span className="viewer-divider" aria-hidden="true" />

          <button
            type="button"
            className="viewer-back-button"
            onClick={() => navigate(-1)}
          >
            <span aria-hidden="true">←</span> Course
          </button>
        </div>

        <p className="viewer-title">{material.title}</p>

        <a
          href={material.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="viewer-external-link"
        >
          Open externally <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main className="viewer-content">
        {mediafire || !viewerUrl ? (
          <section className="viewer-fallback">
            <p className="swift-eyebrow">External material</p>
            <h1>This file opens in its original host.</h1>
            <p>
              Swift cannot preview this material directly, but you can open it
              in a new tab or app.
            </p>
            <a
              href={material.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="swift-primary-button"
            >
              Open material <span aria-hidden="true">↗</span>
            </a>
          </section>
        ) : (
          <iframe
            src={viewerUrl}
            className="material-viewer-frame"
            allow="autoplay"
            title={material.title}
          />
        )}
      </main>
    </div>
  );
}
