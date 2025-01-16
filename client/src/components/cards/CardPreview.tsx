import { Layout } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface CardDesign {
  name: string;
  primaryColor: string;
  backgroundColor: string;
  logo?: string;
  stamps?: number;
}

interface CardPreviewProps {
  design: CardDesign;
  customerId?: string;
  cardId?: number;
}

export function CardPreview({ design, customerId, cardId }: CardPreviewProps) {
  // Generate QR code value based on available IDs
  const qrValue = customerId 
    ? `pkpass://passes.loyaltypro.app/customer/${cardId}/${customerId}`
    : cardId 
      ? `pkpass://passes.loyaltypro.app/preview/${cardId}` 
      : 'preview';

  return (
    <div className="rounded-lg overflow-hidden shadow-lg">
      <div
        className="aspect-[1.586/1] p-6"
        style={{ background: design.backgroundColor }}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-2" style={{ color: design.primaryColor }}>
            {design.logo ? (
              <img 
                src={design.logo} 
                alt="Logo" 
                className="h-8 w-8 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  console.error('Failed to load logo');
                }}
              />
            ) : (
              <Layout className="h-8 w-8" />
            )}
            <span className="font-bold text-lg">{design.name || "Card Name"}</span>
          </div>

          <div className="flex-1 flex justify-center gap-4 my-6">
            {Array.from({ length: design.stamps || 5 }).map((_, i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-full border-2"
                style={{ borderColor: design.primaryColor }}
              />
            ))}
          </div>

          <div className="flex items-center justify-center">
            <div className="bg-white p-2 rounded-lg">
              <QRCodeSVG 
                value={qrValue}
                size={120}
                level="H"
                fgColor={design.primaryColor}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}