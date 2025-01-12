import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, MapPin } from "lucide-react";
import type { Branch } from "@db/schema";

export default function BranchesPage() {
  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Branches</h1>
          <p className="text-muted-foreground mt-2">
            Manage your business locations (up to 3 branches)
          </p>
        </div>
        {(branches?.length || 0) < 3 && (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Branch
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {branches?.map((branch) => (
          <Card key={branch.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {branch.name}
              </CardTitle>
              <CardDescription>Branch #{branch.id}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {branch.address}
              </p>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
