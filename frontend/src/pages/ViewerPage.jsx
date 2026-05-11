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
    // Google Drive — convert to preview URL
    const driveMatch = fileUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }
    // Slides/Docs — convert to preview
    const docsMatch = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)\//);
    if (docsMatch) {
      return `https://docs.google.com/presentation/d/${docsMatch[1]}/embed`;
    }
    // MediaFire and others — use Google Docs viewer as fallback
    return `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
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
      <iframe
        src={getViewerUrl(material?.file_url)}
        className="flex-1 w-full"
        style={{ minHeight: "calc(100vh - 60px)" }}
        allow="autoplay"
        title={material?.title}
      />
    </div>
  );
}
