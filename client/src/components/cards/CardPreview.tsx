import { Layout } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface CardDesign {
  name: string;
  primaryColor: string;
  backgroundColor: string;
  logo?: string;
  stamps?: number;
  gradientEnabled?: boolean;
  gradientColor?: string;
  textColor?: string;
  cardStyle?: string;
}

interface CardPreviewProps {
  design: CardDesign;
  customerId?: string;
  cardId?: number;
}

export function CardPreview({ design, customerId, cardId }: CardPreviewProps) {
  // Generate QR code value based on available IDs
  const qrValue = customerId 
    ? `https://${window.location.host}/api/wallet-pass/${cardId}/${customerId}`
    : cardId 
      ? `https://${window.location.host}/api/cards/${cardId}/wallet-pass` 
      : 'preview';

  // Create background style based on design settings
  const getBackgroundStyle = () => {
    if (design.gradientEnabled && design.gradientColor) {
      return {
        background: `linear-gradient(135deg, ${design.backgroundColor} 0%, ${design.gradientColor} 100%)`
      };
    }
    return { background: design.backgroundColor };
  };

  // Get card style classes
  const getCardStyleClasses = () => {
    switch (design.cardStyle) {
      case 'classic':
        return 'border-2 border-opacity-20';
      case 'minimalist':
        return 'shadow-sm';
      case 'elegant':
        return 'shadow-xl border border-opacity-10';
      default:
        return '';
    }
  };

  return (
    <div className={`rounded-lg overflow-hidden shadow-lg ${getCardStyleClasses()}`}>
      <div
        className="aspect-[1.586/1] p-6"
        style={getBackgroundStyle()}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-2" style={{ color: design.textColor || design.primaryColor }}>
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
              <Layout className="h-4 w-4" />
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