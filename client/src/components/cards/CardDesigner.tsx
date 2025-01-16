import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardPreview } from "./CardPreview";
import { WalletPreview } from "./WalletPreview";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Wallet, CreditCard } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { LoyaltyCard } from "@db/schema";

interface CardDesignerProps {
  initialCard?: LoyaltyCard;
  onClose: () => void;
}

export default function CardDesigner({ initialCard, onClose }: CardDesignerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const [formData, setFormData] = useState({
    name: initialCard?.name || "",
    design: {
      primaryColor: initialCard?.design?.primaryColor || "#000000",
      backgroundColor: initialCard?.design?.backgroundColor || "#ffffff",
      logo: initialCard?.design?.logo || "",
      stamps: initialCard?.design?.stamps || 5,
    }
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);
      console.log("Processing image:", file.name, file.type, file.size);

      const reader = new FileReader();
      reader.onload = () => {
        console.log("Image loaded successfully");
        const base64 = reader.result as string;
        setFormData(prev => ({
          ...prev,
          design: { ...prev.design, logo: base64 }
        }));
      };

      reader.onerror = (error) => {
        console.error("FileReader error:", error);
        toast({
          title: "Error",
          description: "Failed to read image file",
          variant: "destructive",
        });
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Image processing error:", error);
      toast({
        title: "Error",
        description: "Failed to process image",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const saveCard = useMutation({
    mutationFn: async (data: typeof formData) => {
      console.log("Saving card with data:", {
        ...data,
        design: {
          ...data.design,
          logo: data.design.logo ? "base64_data" : null
        }
      });

      const res = await fetch(
        `/api/cards${initialCard ? `/${initialCard.id}` : ''}`,
        {
          method: initialCard ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Card save error:", errorText);
        throw new Error(errorText);
      }

      return res.json();
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
      console.error("Card save mutation error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Card Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
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
              className="cursor-pointer"
              disabled={isProcessing}
            />
            {formData.design.logo && (
              <div className="mt-2">
                <img 
                  src={formData.design.logo} 
                  alt="Logo preview" 
                  className="w-16 h-16 object-contain border rounded"
                  onError={(e) => {
                    console.error("Logo preview error");
                    toast({
                      title: "Error",
                      description: "Failed to load image preview",
                      variant: "destructive",
                    });
                    setFormData(prev => ({
                      ...prev,
                      design: { ...prev.design, logo: "" }
                    }));
                  }}
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

          <Button
            className="w-full"
            onClick={() => saveCard.mutate(formData)}
            disabled={saveCard.isPending || !formData.name}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Card
          </Button>
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
            <CardPreview design={{ ...formData.design, name: formData.name }} />
          </TabsContent>
          <TabsContent value="wallet">
            <WalletPreview design={{ ...formData.design, name: formData.name }} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}