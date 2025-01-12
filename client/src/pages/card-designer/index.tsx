import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import CardDesigner from "@/components/cards/CardDesigner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { LoyaltyCard } from "@db/schema";

export default function CardDesignerPage() {
  const [selectedCard, setSelectedCard] = useState<LoyaltyCard | null>(null);
  
  const { data: cards } = useQuery<LoyaltyCard[]>({
    queryKey: ["/api/cards"],
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
        <Button onClick={() => setSelectedCard(null)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Card
        </Button>
      </div>

      {selectedCard === null ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards?.map((card) => (
            <Card 
              key={card.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedCard(card)}
            >
              <CardHeader>
                <CardTitle>{card.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-[1.586/1] rounded-lg border bg-card">
                  {/* Card preview will be rendered here */}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <CardDesigner 
          initialCard={selectedCard} 
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}
