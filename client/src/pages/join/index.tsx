import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet, CheckCircle2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

interface CardData {
  id: number;
  name: string;
  business: {
    id: number;
    name: string;
    logo?: string;
  };
  design: {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    gradientEnabled?: boolean;
    gradientColor?: string;
    logo?: string;
    loyaltyType: 'stamps' | 'points' | 'membership';
    formTemplate?: {
      welcomeTitle?: string;
      welcomeSubtitle?: string;
      fields?: Array<{
        id: string;
        label: string;
        type: string;
        required: boolean;
        placeholder?: string;
      }>;
      submitButtonText?: string;
      termsText?: string;
      termsUrl?: string;
    };
  };
}

const DEFAULT_FIELDS = [
  { id: 'name', label: 'Full Name', type: 'text', required: true, placeholder: 'First and Last Name' },
  { id: 'email', label: 'Email', type: 'email', required: true, placeholder: 'example@gmail.com' },
  { id: 'phone', label: 'Phone Number', type: 'phone', required: false, placeholder: '+971 50 123 4567' },
];

export default function JoinPage() {
  const { cardId } = useParams<{ cardId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [enrollmentComplete, setEnrollmentComplete] = useState(false);
  const [passDownloadUrl, setPassDownloadUrl] = useState<string | null>(null);

  const { data: card, isLoading, error } = useQuery<CardData>({
    queryKey: ['/api/public/cards', cardId],
    queryFn: async () => {
      const res = await fetch(`/api/public/cards/${cardId}`);
      if (!res.ok) {
        throw new Error('Card not found');
      }
      return res.json();
    },
    enabled: !!cardId,
  });

  const enrollMutation = useMutation({
    mutationFn: async (data: { cardId: string; formData: Record<string, string> }) => {
      const res = await fetch('/api/public/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to enroll');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setEnrollmentComplete(true);
      if (data.passUrl) {
        setPassDownloadUrl(data.passUrl);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const fields = card?.design?.formTemplate?.fields || DEFAULT_FIELDS;
  const welcomeTitle = card?.design?.formTemplate?.welcomeTitle || `Welcome to ${card?.business?.name || 'our program'}`;
  const welcomeSubtitle = card?.design?.formTemplate?.welcomeSubtitle || 'Digital Loyalty Program';
  const submitButtonText = card?.design?.formTemplate?.submitButtonText || 'Join Now';
  const termsText = card?.design?.formTemplate?.termsText;
  const termsUrl = card?.design?.formTemplate?.termsUrl;

  const getLoyaltyTypeLabel = (type: string) => {
    switch (type) {
      case 'stamps': return 'Stamp Card';
      case 'points': return 'Points Card';
      case 'membership': return 'Membership Card';
      default: return 'Loyalty Program';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const requiredFields = fields.filter(f => f.required);
    for (const field of requiredFields) {
      if (!formData[field.id]?.trim()) {
        toast({
          title: "Required Field",
          description: `Please fill in ${field.label}`,
          variant: "destructive",
        });
        return;
      }
    }

    if (termsText && !termsAccepted) {
      toast({
        title: "Terms Required",
        description: "Please accept the terms and conditions",
        variant: "destructive",
      });
      return;
    }

    enrollMutation.mutate({ cardId: cardId!, formData });
  };

  const downloadPass = async () => {
    if (!passDownloadUrl) return;
    
    try {
      const response = await fetch(passDownloadUrl);
      if (!response.ok) throw new Error('Failed to download pass');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${card?.name || 'loyalty'}.pkpass`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download pass. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold mb-2">Card Not Found</h1>
          <p className="text-muted-foreground">This loyalty card is no longer available.</p>
          <Link href="/">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const bgStyle = card.design.gradientEnabled
    ? { background: `linear-gradient(180deg, ${card.design.backgroundColor}, ${card.design.gradientColor || card.design.backgroundColor})` }
    : { backgroundColor: card.design.backgroundColor };

  if (enrollmentComplete) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={bgStyle}
      >
        <div className="w-full max-w-md text-center space-y-6">
          {(card.design.logo || card.business?.logo) && (
            <img 
              src={card.design.logo || card.business?.logo} 
              alt={card.business?.name}
              className="h-20 mx-auto object-contain"
            />
          )}
          
          <div className="space-y-2">
            <CheckCircle2 
              className="h-16 w-16 mx-auto" 
              style={{ color: card.design.primaryColor }}
            />
            <h1 
              className="text-2xl font-bold"
              style={{ color: card.design.textColor }}
            >
              One last step to go!
            </h1>
            <p 
              className="text-lg"
              style={{ color: card.design.textColor, opacity: 0.9 }}
            >
              Press Add to Wallet
            </p>
          </div>

          <Button
            size="lg"
            className="w-full max-w-xs mx-auto h-14 text-lg font-semibold gap-3"
            style={{ 
              backgroundColor: '#000000',
              color: '#FFFFFF',
            }}
            onClick={downloadPass}
          >
            <Wallet className="h-6 w-6" />
            <span>Add to Apple Wallet</span>
          </Button>

          <p 
            className="text-sm mt-8"
            style={{ color: card.design.textColor, opacity: 0.6 }}
          >
            © {new Date().getFullYear()} {card.business?.name}. All Rights Reserved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={bgStyle}
    >
      <div className="absolute top-4 left-4">
        <Link href="/">
          <Button 
            variant="ghost" 
            size="icon"
            className="bg-white/20 hover:bg-white/30"
            style={{ color: card.design.textColor }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-4 py-8">
        <div className="w-full max-w-md space-y-8">
          {(card.design.logo || card.business?.logo) && (
            <div className="text-center">
              <img 
                src={card.design.logo || card.business?.logo} 
                alt={card.business?.name}
                className="h-24 mx-auto object-contain"
              />
            </div>
          )}

          <div className="text-center space-y-2">
            <h1 
              className="text-2xl sm:text-3xl font-bold"
              style={{ color: card.design.textColor }}
            >
              {welcomeTitle}
            </h1>
            <p 
              className="text-lg"
              style={{ color: card.design.textColor, opacity: 0.8 }}
            >
              {welcomeSubtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label 
                  htmlFor={field.id}
                  style={{ color: card.design.textColor, opacity: 0.9 }}
                  className="text-sm font-medium uppercase tracking-wide"
                >
                  {field.label}
                </Label>
                <Input
                  id={field.id}
                  type={field.type === 'phone' ? 'tel' : field.type}
                  placeholder={field.placeholder}
                  value={formData[field.id] || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, [field.id]: e.target.value }))}
                  required={field.required}
                  className="h-12 bg-white/90 border-0 text-gray-900 placeholder:text-gray-500"
                />
              </div>
            ))}

            {termsText && (
              <div className="flex items-start gap-3 pt-2">
                <Checkbox 
                  id="terms" 
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  className="mt-1 border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-gray-900"
                />
                <Label 
                  htmlFor="terms" 
                  className="text-sm leading-relaxed cursor-pointer"
                  style={{ color: card.design.textColor, opacity: 0.9 }}
                >
                  {termsUrl ? (
                    <a href={termsUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      {termsText}
                    </a>
                  ) : (
                    termsText
                  )}
                </Label>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full h-14 text-lg font-semibold mt-6"
              style={{ 
                backgroundColor: card.design.primaryColor,
                color: card.design.textColor,
              }}
              disabled={enrollMutation.isPending}
            >
              {enrollMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : null}
              {submitButtonText}
            </Button>
          </form>
        </div>
      </div>

      <div 
        className="text-center py-4"
        style={{ 
          backgroundColor: card.design.primaryColor,
          color: card.design.textColor,
        }}
      >
        <p className="text-sm opacity-80">
          © {new Date().getFullYear()} {card.business?.name}. All Rights Reserved.
        </p>
      </div>
    </div>
  );
}
