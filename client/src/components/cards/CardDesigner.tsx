import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CardPreview } from "./CardPreview";
import { WalletPreview } from "./WalletPreview";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Wallet, CreditCard, Check, Sparkles, Stamp, Star, Users } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { LoyaltyCard } from "@db/schema";

const TEMPLATES = [
  {
    id: "coffee",
    name: "Coffee Shop",
    category: "Food & Drink",
    design: {
      primaryColor: "#4A2C2A",
      backgroundColor: "#D4A574",
      gradientEnabled: true,
      gradientColor: "#8B5E3C",
      textColor: "#FFFFFF",
      cardStyle: "modern",
      stamps: 8,
    }
  },
  {
    id: "gym",
    name: "Fitness Center",
    category: "Health",
    design: {
      primaryColor: "#FF6B35",
      backgroundColor: "#1A1A2E",
      gradientEnabled: true,
      gradientColor: "#16213E",
      textColor: "#FFFFFF",
      cardStyle: "modern",
      stamps: 10,
    }
  },
  {
    id: "spa",
    name: "Beauty & Spa",
    category: "Wellness",
    design: {
      primaryColor: "#E8B4BC",
      backgroundColor: "#FAF0F3",
      gradientEnabled: true,
      gradientColor: "#F5E6E8",
      textColor: "#4A3540",
      cardStyle: "elegant",
      stamps: 5,
    }
  },
  {
    id: "restaurant",
    name: "Restaurant",
    category: "Food & Drink",
    design: {
      primaryColor: "#C41E3A",
      backgroundColor: "#1C1C1C",
      gradientEnabled: true,
      gradientColor: "#2D2D2D",
      textColor: "#FFFFFF",
      cardStyle: "classic",
      stamps: 6,
    }
  },
  {
    id: "retail",
    name: "Retail Store",
    category: "Shopping",
    design: {
      primaryColor: "#2563EB",
      backgroundColor: "#FFFFFF",
      gradientEnabled: false,
      gradientColor: "#EFF6FF",
      textColor: "#1E3A8A",
      cardStyle: "minimalist",
      stamps: 10,
    }
  },
  {
    id: "pet",
    name: "Pet Care",
    category: "Services",
    design: {
      primaryColor: "#10B981",
      backgroundColor: "#ECFDF5",
      gradientEnabled: true,
      gradientColor: "#D1FAE5",
      textColor: "#065F46",
      cardStyle: "modern",
      stamps: 8,
    }
  },
  {
    id: "sports",
    name: "Sports Club",
    category: "Fitness",
    design: {
      primaryColor: "#22C55E",
      backgroundColor: "#14532D",
      gradientEnabled: true,
      gradientColor: "#052E16",
      textColor: "#FFFFFF",
      cardStyle: "modern",
      stamps: 10,
    }
  },
  {
    id: "bakery",
    name: "Bakery",
    category: "Food & Drink",
    design: {
      primaryColor: "#F59E0B",
      backgroundColor: "#FFFBEB",
      gradientEnabled: true,
      gradientColor: "#FEF3C7",
      textColor: "#78350F",
      cardStyle: "classic",
      stamps: 6,
    }
  },
];

const LOYALTY_TYPES = [
  {
    id: 'stamps',
    name: 'Stamp Card',
    icon: Stamp,
    description: 'Collect stamps, earn rewards',
    example: 'Coffee shops, bakeries',
  },
  {
    id: 'points',
    name: 'Points Card',
    icon: Star,
    description: 'Earn points per purchase',
    example: 'Retail, services',
  },
  {
    id: 'membership',
    name: 'Membership',
    icon: Users,
    description: 'Track visits and entries',
    example: 'Gyms, clubs',
  },
];

interface CardDesignerProps {
  initialCard?: LoyaltyCard;
  onClose: () => void;
}

export default function CardDesigner({ initialCard, onClose }: CardDesignerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: initialCard?.name || "",
    design: {
      primaryColor: initialCard?.design?.primaryColor || "#000000",
      backgroundColor: initialCard?.design?.backgroundColor || "#ffffff",
      logo: initialCard?.design?.logo || "",
      stamps: initialCard?.design?.stamps || 5,
      gradientEnabled: initialCard?.design?.gradientEnabled || false,
      gradientColor: initialCard?.design?.gradientColor || "#f0f0f0",
      textColor: initialCard?.design?.textColor || "#ffffff",
      cardStyle: initialCard?.design?.cardStyle || "modern",
      loyaltyType: (initialCard?.design as any)?.loyaltyType || "stamps",
      maxStamps: (initialCard?.design as any)?.maxStamps || 10,
      pointsPerCurrency: (initialCard?.design as any)?.pointsPerCurrency || 1,
      rewardThreshold: (initialCard?.design as any)?.rewardThreshold || 100,
      rewardDescription: (initialCard?.design as any)?.rewardDescription || "",
      formTemplate: (initialCard?.design as any)?.formTemplate || {
        welcomeTitle: '',
        welcomeSubtitle: 'Digital Loyalty Program',
        submitButtonText: 'Join Now',
        termsText: '',
        termsUrl: '',
      },
    }
  });

  const applyTemplate = (templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setFormData(prev => ({
        ...prev,
        design: {
          ...prev.design,
          ...template.design,
          logo: prev.design.logo,
        }
      }));
      toast({
        title: "Template Applied",
        description: `${template.name} template has been applied`,
      });
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        setFormData(prev => ({
          ...prev,
          design: { ...prev.design, logo: result }
        }));
      }
    };

    reader.readAsDataURL(file);
  };

  const saveCard = useMutation({
    mutationFn: async (data: typeof formData) => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/cards${initialCard ? `/${initialCard.id}` : ''}`,
          {
            method: initialCard ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          }
        );

        if (!res.ok) {
          const error = await res.text();
          throw new Error(error);
        }

        return res.json();
      } finally {
        setIsLoading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cards'] });
      toast({
        title: "Success",
        description: `Card ${initialCard ? 'updated' : 'created'} successfully`,
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateWalletPass = async () => {
    if (!initialCard) {
      toast({
        title: "Error",
        description: "Please save the card first before generating a wallet pass",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/cards/${initialCard.id}/wallet-pass`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate wallet pass');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formData.name.replace(/\s+/g, '_')}.pkpass`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Wallet pass generated successfully. Please check your downloads.",
      });
    } catch (error: any) {
      console.error('Wallet pass generation error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-2xl font-bold">
          {initialCard ? 'Edit Card' : 'Create New Card'}
        </h2>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr,400px]">
        <div className="space-y-6 pb-8">
          {!initialCard && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Choose Your Loyalty Type</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {LOYALTY_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      className={`p-5 rounded-xl border-2 transition-all text-left hover:shadow-md ${
                        formData.design.loyaltyType === type.id 
                          ? 'border-primary bg-primary/5 shadow-md' 
                          : 'border-muted hover:border-primary/50'
                      }`}
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        design: { ...prev.design, loyaltyType: type.id }
                      }))}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${
                          formData.design.loyaltyType === type.id 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        {formData.design.loyaltyType === type.id && (
                          <Check className="h-4 w-4 text-primary ml-auto" />
                        )}
                      </div>
                      <div className="font-semibold">{type.name}</div>
                      <div className="text-sm text-muted-foreground mt-1">{type.description}</div>
                      <div className="text-xs text-muted-foreground/70 mt-2 italic">{type.example}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!initialCard && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Quick Start Templates</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TEMPLATES.map((template) => (
                  <Card 
                    key={template.id}
                    className={`cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg ${
                      selectedTemplate === template.id ? 'ring-2 ring-primary shadow-lg' : ''
                    }`}
                    onClick={() => applyTemplate(template.id)}
                  >
                    <CardContent className="p-3">
                      <div 
                        className="h-16 sm:h-20 rounded-lg mb-3 relative overflow-hidden"
                        style={{
                          background: template.design.gradientEnabled 
                            ? `linear-gradient(135deg, ${template.design.backgroundColor}, ${template.design.gradientColor})`
                            : template.design.backgroundColor
                        }}
                      >
                        <div 
                          className="absolute bottom-2 left-2 w-3 h-3 rounded-full"
                          style={{ backgroundColor: template.design.primaryColor }}
                        />
                        {selectedTemplate === template.id && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Check className="h-6 w-6 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-medium text-center truncate">{template.name}</p>
                      <p className="text-xs text-muted-foreground text-center truncate">{template.category}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-base font-semibold">Card Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., ISF Members Card"
                  className="h-12"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo" className="text-base font-semibold">Business Logo</Label>
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={isLoading}
                  className="h-12"
                />
                {formData.design.logo && (
                  <div className="mt-2 p-4 border rounded-lg bg-muted/50 inline-block">
                    <img
                      src={formData.design.logo}
                      alt="Logo preview"
                      className="w-20 h-20 object-contain"
                    />
                  </div>
                )}
              </div>

              {formData.design.loyaltyType === 'stamps' && (
                <div className="space-y-2">
                  <Label htmlFor="maxStamps" className="text-base font-semibold">Stamps to Earn Reward</Label>
                  <Input
                    id="maxStamps"
                    type="number"
                    min="1"
                    max="20"
                    value={formData.design.maxStamps}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      design: { ...prev.design, maxStamps: parseInt(e.target.value) || 10, stamps: parseInt(e.target.value) || 10 }
                    }))}
                    className="h-12"
                  />
                  <p className="text-sm text-muted-foreground">
                    Number of stamps needed to earn a reward
                  </p>
                </div>
              )}

              {formData.design.loyaltyType === 'points' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pointsPerCurrency" className="text-base font-semibold">Points per 1 AED spent</Label>
                    <Input
                      id="pointsPerCurrency"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.design.pointsPerCurrency}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        design: { ...prev.design, pointsPerCurrency: parseInt(e.target.value) || 1 }
                      }))}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rewardThreshold" className="text-base font-semibold">Points for Reward</Label>
                    <Input
                      id="rewardThreshold"
                      type="number"
                      min="10"
                      max="10000"
                      value={formData.design.rewardThreshold}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        design: { ...prev.design, rewardThreshold: parseInt(e.target.value) || 100 }
                      }))}
                      className="h-12"
                    />
                  </div>
                </div>
              )}

              {formData.design.loyaltyType === 'membership' && (
                <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30">
                  <Badge variant="secondary" className="mb-2">Membership Card</Badge>
                  <p className="text-sm text-muted-foreground">
                    Membership cards track visit entries. When staff scans a customer's pass, 
                    it logs their visit automatically. Perfect for gyms, clubs, and subscription services.
                  </p>
                </div>
              )}

              {formData.design.loyaltyType !== 'membership' && (
                <div className="space-y-2">
                  <Label htmlFor="rewardDescription" className="text-base font-semibold">Reward Description</Label>
                  <Input
                    id="rewardDescription"
                    value={formData.design.rewardDescription}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      design: { ...prev.design, rewardDescription: e.target.value }
                    }))}
                    placeholder={formData.design.loyaltyType === 'stamps' 
                      ? "e.g., Free coffee after 10 stamps" 
                      : "e.g., 10 AED off when you reach 100 points"}
                    className="h-12"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-6">
              <h3 className="text-lg font-semibold">Card Design</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={formData.design.primaryColor}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        design: { ...prev.design, primaryColor: e.target.value }
                      }))}
                      className="w-14 h-12 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.design.primaryColor}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        design: { ...prev.design, primaryColor: e.target.value }
                      }))}
                      className="h-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="backgroundColor">Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="backgroundColor"
                      type="color"
                      value={formData.design.backgroundColor}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        design: { ...prev.design, backgroundColor: e.target.value }
                      }))}
                      className="w-14 h-12 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.design.backgroundColor}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        design: { ...prev.design, backgroundColor: e.target.value }
                      }))}
                      className="h-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="textColor">Text Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="textColor"
                      type="color"
                      value={formData.design.textColor}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        design: { ...prev.design, textColor: e.target.value }
                      }))}
                      className="w-14 h-12 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.design.textColor}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        design: { ...prev.design, textColor: e.target.value }
                      }))}
                      className="h-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardStyle">Card Style</Label>
                  <Select
                    value={formData.design.cardStyle}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      design: { ...prev.design, cardStyle: value }
                    }))}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select a style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="classic">Classic</SelectItem>
                      <SelectItem value="minimalist">Minimalist</SelectItem>
                      <SelectItem value="elegant">Elegant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor="gradient" className="font-medium">Enable Gradient Background</Label>
                  <p className="text-sm text-muted-foreground mt-1">Add depth with a gradient effect</p>
                </div>
                <Switch
                  id="gradient"
                  checked={formData.design.gradientEnabled}
                  onCheckedChange={(checked) => setFormData(prev => ({
                    ...prev,
                    design: { ...prev.design, gradientEnabled: checked }
                  }))}
                />
              </div>

              {formData.design.gradientEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="gradientColor">Gradient Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="gradientColor"
                      type="color"
                      value={formData.design.gradientColor}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        design: { ...prev.design, gradientColor: e.target.value }
                      }))}
                      className="w-14 h-12 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.design.gradientColor}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        design: { ...prev.design, gradientColor: e.target.value }
                      }))}
                      className="h-12"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Enrollment Form</h3>
                <Badge variant="outline">Customer Sign-up</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Customize the form customers see when they scan your QR code to join.
              </p>
              
              <div className="space-y-2">
                <Label htmlFor="welcomeTitle" className="text-base font-semibold">Welcome Title</Label>
                <Input
                  id="welcomeTitle"
                  value={(formData.design as any).formTemplate?.welcomeTitle ?? ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    design: { 
                      ...prev.design, 
                      formTemplate: {
                        ...(prev.design as any).formTemplate,
                        welcomeTitle: e.target.value 
                      }
                    }
                  }))}
                  placeholder={`e.g., Welcome to ${formData.name || 'Our Loyalty Program'}`}
                  className="h-12"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for default: "Welcome to [Card Name]"
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="welcomeSubtitle" className="text-base font-semibold">Welcome Subtitle</Label>
                <Input
                  id="welcomeSubtitle"
                  value={(formData.design as any).formTemplate?.welcomeSubtitle ?? ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    design: { 
                      ...prev.design, 
                      formTemplate: {
                        ...(prev.design as any).formTemplate,
                        welcomeSubtitle: e.target.value 
                      }
                    }
                  }))}
                  placeholder="e.g., Digital Loyalty Program"
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="submitButtonText" className="text-base font-semibold">Submit Button Text</Label>
                <Input
                  id="submitButtonText"
                  value={(formData.design as any).formTemplate?.submitButtonText ?? ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    design: { 
                      ...prev.design, 
                      formTemplate: {
                        ...(prev.design as any).formTemplate,
                        submitButtonText: e.target.value 
                      }
                    }
                  }))}
                  placeholder="e.g., Join Now, Enroll, Sign Up"
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="termsText" className="text-base font-semibold">Terms & Conditions (optional)</Label>
                <Input
                  id="termsText"
                  value={(formData.design as any).formTemplate?.termsText ?? ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    design: { 
                      ...prev.design, 
                      formTemplate: {
                        ...(prev.design as any).formTemplate,
                        termsText: e.target.value 
                      }
                    }
                  }))}
                  placeholder="e.g., I agree to the terms and conditions"
                  className="h-12"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to skip terms checkbox
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              className="flex-1 h-12"
              onClick={() => saveCard.mutate(formData)}
              disabled={isLoading || !formData.name}
            >
              <Save className="mr-2 h-4 w-4" />
              {initialCard ? 'Update Card' : 'Create Card'}
            </Button>

            {initialCard && (
              <Button
                className="flex-1 h-12"
                variant="outline"
                onClick={generateWalletPass}
                disabled={isLoading}
              >
                <Wallet className="mr-2 h-4 w-4" />
                Generate Wallet Pass
              </Button>
            )}
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-4">
            <Tabs defaultValue="card">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="card" className="flex-1 flex items-center justify-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Card
                </TabsTrigger>
                <TabsTrigger value="wallet" className="flex-1 flex items-center justify-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Wallet
                </TabsTrigger>
              </TabsList>
              <TabsContent value="card">
                <CardPreview
                  design={{ ...formData.design, name: formData.name }}
                  cardId={initialCard?.id}
                />
              </TabsContent>
              <TabsContent value="wallet">
                <WalletPreview
                  design={{ ...formData.design, name: formData.name }}
                  cardId={initialCard?.id}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-50">
          <Tabs defaultValue="card">
            <TabsList className="w-full mb-2">
              <TabsTrigger value="card" className="flex-1">Card Preview</TabsTrigger>
              <TabsTrigger value="wallet" className="flex-1">Wallet Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="card" className="max-h-[200px] overflow-auto">
              <CardPreview
                design={{ ...formData.design, name: formData.name }}
                cardId={initialCard?.id}
              />
            </TabsContent>
            <TabsContent value="wallet" className="max-h-[200px] overflow-auto">
              <WalletPreview
                design={{ ...formData.design, name: formData.name }}
                cardId={initialCard?.id}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
