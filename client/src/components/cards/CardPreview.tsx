import { Layout } from "lucide-react";

interface CardPreviewProps {
  design: {
    name: string;
    primaryColor: string;
    backgroundColor: string;
    logo?: string;
  };
}

export function CardPreview({ design }: CardPreviewProps) {
  return (
    <div className="rounded-lg overflow-hidden shadow-lg">
      <div
        className="aspect-[1.586/1] p-6"
        style={{ background: design.backgroundColor }}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-2 mb-4" style={{ color: design.primaryColor }}>
            {design.logo ? (
              <img src={design.logo} alt="Logo" className="h-8 w-8" />
            ) : (
              <Layout className="h-8 w-8" />
            )}
            <span className="font-bold text-lg">{design.name || "Card Name"}</span>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div
              className="w-48 h-48 rounded-lg border-2 flex items-center justify-center"
              style={{ borderColor: design.primaryColor }}
            >
              <span className="text-sm" style={{ color: design.primaryColor }}>
                QR Code Placeholder
              </span>
            </div>
          </div>

          <div
            className="mt-4 text-sm text-center"
            style={{ color: design.primaryColor }}
          >
            Scan to join our loyalty program
          </div>
        </div>
      </div>
    </div>
  );
}
