import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CardPreview } from "./CardPreview";
import { WalletPreview } from "./WalletPreview";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Wallet, CreditCard, Palette, Check, Sparkles } from "lucide-react";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { LoyaltyCard } from "@db/schema";

const TEMPLATES = [
  {
    id: "coffee",
    name: "Coffee Shop",
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
    design: {
      primaryColor: "#0EA5E9",
      backgroundColor: "#0C4A6E",
      gradientEnabled: true,
      gradientColor: "#082F49",
      textColor: "#FFFFFF",
      cardStyle: "modern",
      stamps: 10,
    }
  },
  {
    id: "bakery",
    name: "Bakery",
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

    // Simple file type validation
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Simple size validation (5MB)
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

      // Create blob from response and download
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
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold">
            {initialCard ? 'Edit Card' : 'Create New Card'}
          </h2>
        </div>

        <div className="space-y-6">
          {!initialCard && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <Label className="text-base font-semibold">Quick Start Templates</Label>
              </div>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-3 pb-4">
                  {TEMPLATES.map((template) => (
                    <Card 
                      key={template.id}
                      className={`cursor-pointer transition-all hover:scale-105 flex-shrink-0 w-28 ${
                        selectedTemplate === template.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => applyTemplate(template.id)}
                    >
                      <CardContent className="p-3">
                        <div 
                          className="h-12 rounded-md mb-2 relative"
                          style={{
                            background: template.design.gradientEnabled 
                              ? `linear-gradient(135deg, ${template.design.backgroundColor}, ${template.design.gradientColor})`
                              : template.design.backgroundColor
                          }}
                        >
                          {selectedTemplate === template.id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md">
                              <Check className="h-5 w-5 text-white" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs font-medium text-center truncate">{template.name}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Card Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., ISF Members Card"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo">Business Logo</Label>
            <Input
              id="logo"
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={isLoading}
            />
            {formData.design.logo && (
              <div className="mt-2">
                <img
                  src={formData.design.logo}
                  alt="Logo preview"
                  className="w-16 h-16 object-contain border rounded"
                />
              </div>
            )}
          </div>

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
                className="w-20"
              />
              <Input
                value={formData.design.primaryColor}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  design: { ...prev.design, primaryColor: e.target.value }
                }))}
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
                className="w-20"
              />
              <Input
                value={formData.design.backgroundColor}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  design: { ...prev.design, backgroundColor: e.target.value }
                }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stamps">Number of Stamps</Label>
            <Input
              id="stamps"
              type="number"
              min="1"
              max="10"
              value={formData.design.stamps}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                design: { ...prev.design, stamps: parseInt(e.target.value) || 5 }
              }))}
            />
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
              <SelectTrigger>
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

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="gradient"
                checked={formData.design.gradientEnabled}
                onCheckedChange={(checked) => setFormData(prev => ({
                  ...prev,
                  design: { ...prev.design, gradientEnabled: checked }
                }))}
              />
              <Label htmlFor="gradient">Enable Gradient Background</Label>
            </div>
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
                  className="w-20"
                />
                <Input
                  value={formData.design.gradientColor}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    design: { ...prev.design, gradientColor: e.target.value }
                  }))}
                />
              </div>
            </div>
          )}

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
                className="w-20"
              />
              <Input
                value={formData.design.textColor}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  design: { ...prev.design, textColor: e.target.value }
                }))}
              />
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => saveCard.mutate(formData)}
            disabled={isLoading || !formData.name}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Card
          </Button>

          {initialCard && (
            <Button
              className="w-full mt-2"
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

      <div>
        <Tabs defaultValue="card">
          <TabsList className="mb-4">
            <TabsTrigger value="card" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Card Preview
            </TabsTrigger>
            <TabsTrigger value="wallet" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Wallet Preview
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
  );
}