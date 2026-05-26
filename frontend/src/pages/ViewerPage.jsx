import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ViewerPage() {
  const { materialId } = useParams();
  const navigate = useNavigate();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMaterial() {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .eq("id", materialId)
        .single();
      if (!error) setMaterial(data);
      setLoading(false);
    }
    fetchMaterial();
  }, [materialId]);

  function getViewerUrl(fileUrl) {
    const driveMatch = fileUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }
    const docsMatch = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)\//);
    if (docsMatch) {
      return `https://docs.google.com/presentation/d/${docsMatch[1]}/embed`;
    }
    return null;
  }

  function isMediaFire(fileUrl) {
    return fileUrl?.includes("mediafire.com");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm font-bold animate-pulse">
          Loading...
        </p>
      </div>
    );
  }

  const viewerUrl = getViewerUrl(material?.file_url);
  const mediafire = isMediaFire(material?.file_url);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-800">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-white text-sm font-bold transition-colors"
        >
          ← Back
        </button>
        <p className="text-white font-black text-sm truncate">
          {material?.title}
        </p>
      </div>

      {/* Viewer */}
      {mediafire ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <p className="text-gray-400 text-sm text-center">
            This file is hosted on MediaFire and cannot be previewed directly.
          </p>

          <a
            href={material?.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-black font-black text-sm px-6 py-3 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Open File →
          </a>
        </div>
      ) : viewerUrl ? (
        <iframe
          src={viewerUrl}
          className="flex-1 w-full"
          style={{ minHeight: "calc(100vh - 60px)" }}
          allow="autoplay"
          title={material?.title}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <p className="text-gray-400 text-sm text-center">
            This file cannot be previewed directly.
          </p>

          <a
            href={material?.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-black font-black text-sm px-6 py-3 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Open File →
          </a>
        </div>
      )}
    </div>
  );
}
