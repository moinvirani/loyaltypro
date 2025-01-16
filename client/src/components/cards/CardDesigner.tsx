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
    primaryColor: "#000000",
    backgroundColor: "#ffffff",
    logo: initialCard?.design?.logo || "",
  });

  const saveCard = useMutation({
    mutationFn: async (cardData: typeof design) => {
      const res = await fetch(`/api/cards${initialCard ? `/${initialCard.id}` : ''}`, {
        method: initialCard ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardData),
      });

      if (!res.ok) throw new Error('Failed to save card');
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
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save card",
        variant: "destructive",
      });
    },
  });

  const generateWalletPass = async () => {
    if (!initialCard) {
      toast({
        title: "Error",
        description: "Please save the card first",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch(`/api/cards/${initialCard.id}/wallet-pass`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to generate pass');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${design.name}.pkpass`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Wallet pass generated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate wallet pass",
        variant: "destructive",
      });
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

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Card Name</Label>
            <Input
              id="name"
              value={design.name}
              onChange={(e) => setDesign(d => ({ ...d, name: e.target.value }))}
            />
          </div>

          <div>
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

          <div>
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

          <div className="flex gap-2">
            <Button 
              className="flex-1"
              onClick={() => saveCard.mutate(design)}
              disabled={saveCard.isPending}
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