import { Layout } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface CardDesign {
  name: string;
  primaryColor: string;
  backgroundColor: string;
  logo?: string;
  gradientEnabled?: boolean;
  gradientColor?: string;
  textColor?: string;
  cardStyle?: string;
}

interface WalletPreviewProps {
  design: CardDesign;
  cardId?: number;
}

export function WalletPreview({ design, cardId }: WalletPreviewProps) {
  // Generate QR code value based on card ID - points to customer enrollment page
  const qrValue = cardId 
    ? `https://${window.location.host}/join/${cardId}`
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

  return (
    <div className="rounded-xl overflow-hidden shadow-lg max-w-sm mx-auto">
      {/* Header bar to simulate iOS wallet */}
      <div className="bg-black text-white px-4 py-2 text-sm flex items-center justify-between">
        <span>Pass Preview</span>
        <span className="text-xs opacity-75">Wallet</span>
      </div>

      {/* Pass content */}
      <div className="bg-white">
        {/* Pass header */}
        <div className="p-4 border-b" style={getBackgroundStyle()}>
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
              <Layout className="h-8 w-8" />
            )}
            <div>
              <h3 className="font-semibold">{design.name || "Card Name"}</h3>
              <p className="text-xs opacity-75">Loyalty Card</p>
            </div>
          </div>
        </div>

        {/* Pass body */}
        <div className="p-4">
          {/* Points balance */}
          <div className="mb-4">
            <div className="text-sm text-gray-600">POINTS BALANCE</div>
            <div className="text-2xl font-bold">0</div>
          </div>

          {/* QR Code */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <QRCodeSVG 
              value={qrValue}
              size={180}
              level="H"
              fgColor={design.primaryColor}
              className="bg-white p-2 rounded-lg"
            />
            <div className="text-xs text-gray-500 text-center">
              Scan to add to Apple Wallet
            </div>
          </div>
        </div>

        {/* Pass footer */}
        <div 
          className="px-4 py-3 text-xs border-t text-center"
          style={{ color: design.primaryColor }}
        >
          Powered by Loyalty Pro
        </div>
      </div>
    </div>
  );
}