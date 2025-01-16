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

  const [design, setDesign] = useState({
    name: initialCard?.name || "",
    primaryColor: initialCard?.design?.primaryColor || "#000000",
    backgroundColor: initialCard?.design?.backgroundColor || "#ffffff",
    logo: initialCard?.design?.logo || "",
    stamps: initialCard?.design?.stamps || 5,
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      // Create an image element to get dimensions
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        // Create a canvas to resize the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set maximum dimensions
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;

        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        // Set canvas dimensions and draw resized image
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        // Get base64 string with reduced quality
        const resizedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setDesign(d => ({ ...d, logo: resizedBase64 }));
      };

      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process image",
        variant: "destructive",
      });
    }
  };

  const saveCard = useMutation({
    mutationFn: async (data: typeof design) => {
      const res = await fetch(`/api/cards${initialCard ? `/${initialCard.id}` : ''}`, {
        method: initialCard ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          design: {
            primaryColor: data.primaryColor,
            backgroundColor: data.backgroundColor,
            logo: data.logo,
            stamps: data.stamps
          },
          isActive: true
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cards'] });
      if (!initialCard) {
        // If this was a new card, update the URL and state to show the QR code
        window.history.replaceState(null, '', `/cards/${data.id}`);
      }
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

  // Generate a shareable URL for customers
  const getShareableUrl = () => {
    if (!initialCard) return null;
    const baseUrl = window.location.origin;
    return `${baseUrl}/api/wallet-pass/${initialCard.id}/${Date.now()}`;
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

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Card Name</Label>
            <Input
              id="name"
              value={design.name}
              onChange={(e) => setDesign(d => ({ ...d, name: e.target.value }))}
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
            />
            {design.logo && (
              <div className="mt-2">
                <img 
                  src={design.logo} 
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
                value={design.primaryColor}
                onChange={(e) => setDesign(d => ({ ...d, primaryColor: e.target.value }))}
                className="w-20"
              />
              <Input
                value={design.primaryColor}
                onChange={(e) => setDesign(d => ({ ...d, primaryColor: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="backgroundColor">Background Color</Label>
            <div className="flex gap-2">
              <Input
                id="backgroundColor"
                type="color"
                value={design.backgroundColor}
                onChange={(e) => setDesign(d => ({ ...d, backgroundColor: e.target.value }))}
                className="w-20"
              />
              <Input
                value={design.backgroundColor}
                onChange={(e) => setDesign(d => ({ ...d, backgroundColor: e.target.value }))}
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
              value={design.stamps}
              onChange={(e) => setDesign(d => ({ ...d, stamps: parseInt(e.target.value) || 5 }))}
            />
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => saveCard.mutate(design)}
              disabled={saveCard.isPending || !design.name}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Card
            </Button>

            {initialCard && (
              <Button
                variant="secondary"
                onClick={generateWalletPass}
                className="flex-1"
              >
                <Wallet className="mr-2 h-4 w-4" />
                Add to Apple Wallet
              </Button>
            )}
          </div>

          {initialCard && design.logo && (
            <div className="mt-4">
              <Label>Share with Customers</Label>
              <CardPreview
                design={design}
                customerId={getShareableUrl()}
              />
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Scan QR code to add to Apple Wallet
              </p>
            </div>
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
            <CardPreview design={design} />
          </TabsContent>
          <TabsContent value="wallet">
            <WalletPreview design={design} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}