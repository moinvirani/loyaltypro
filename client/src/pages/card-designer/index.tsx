import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlusCircle, Trash2 } from "lucide-react";
import CardDesigner from "@/components/cards/CardDesigner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CardPreview } from "@/components/cards/CardPreview";
import { useToast } from "@/hooks/use-toast";
import type { LoyaltyCard } from "@db/schema";

export default function CardDesignerPage() {
  const [selectedCard, setSelectedCard] = useState<LoyaltyCard | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: cards } = useQuery<LoyaltyCard[]>({
    queryKey: ["/api/cards"],
  });

  const deleteCard = useMutation({
    mutationFn: async (cardId: number) => {
      const res = await fetch(`/api/cards/${cardId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cards'] });
      toast({
        title: "Success",
        description: "Card deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Card Designer</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage your loyalty cards
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Card
        </Button>
      </div>

      {isCreating ? (
        <CardDesigner onClose={() => setIsCreating(false)} />
      ) : selectedCard ? (
        <CardDesigner 
          initialCard={selectedCard} 
          onClose={() => setSelectedCard(null)}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards?.map((card) => (
            <Card 
              key={card.id}
              className="relative group"
            >
              <div 
                className="cursor-pointer"
                onClick={() => setSelectedCard(card)}
              >
                <CardHeader>
                  <CardTitle>{card.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-[1.586/1]">
                    <CardPreview
                      design={{
                        name: card.name,
                        primaryColor: card.design.primaryColor,
                        backgroundColor: card.design.backgroundColor,
                        logo: card.design.logo,
                        stamps: card.design.stamps
                      }}
                      cardId={card.id}
                    />
                  </div>
                </CardContent>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Card</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this card? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteCard.mutate(card.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}