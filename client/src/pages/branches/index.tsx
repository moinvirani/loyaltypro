import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, MapPin, Pencil, Trash2 } from "lucide-react";
import type { Branch } from "@db/schema";

interface BranchFormData {
  name: string;
  address: string;
}

export default function BranchesPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const createBranch = useMutation({
    mutationFn: async (data: BranchFormData) => {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setIsCreating(false);
      toast({
        title: "Success",
        description: "Branch created successfully",
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

  const updateBranch = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: BranchFormData }) => {
      const res = await fetch(`/api/branches/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setEditingBranch(null);
      toast({
        title: "Success",
        description: "Branch updated successfully",
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

  const deleteBranch = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/branches/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      toast({
        title: "Success",
        description: "Branch deleted successfully",
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

  const BranchForm = ({ branch, onSubmit }: { branch?: Branch; onSubmit: (data: BranchFormData) => void }) => {
    const [formData, setFormData] = useState<BranchFormData>({
      name: branch?.name || "",
      address: branch?.address || "",
    });

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(formData);
        }}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="name">Branch Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(d => ({ ...d, name: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData(d => ({ ...d, address: e.target.value }))}
            required
          />
        </div>
        <Button type="submit" className="w-full">
          {branch ? "Update Branch" : "Create Branch"}
        </Button>
      </form>
    );
  };

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
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Branch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Branch</DialogTitle>
              </DialogHeader>
              <BranchForm onSubmit={(data) => createBranch.mutate(data)} />
            </DialogContent>
          </Dialog>
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
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Dialog open={editingBranch?.id === branch.id} onOpenChange={(open) => !open && setEditingBranch(null)}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setEditingBranch(branch)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Branch</DialogTitle>
                  </DialogHeader>
                  <BranchForm
                    branch={branch}
                    onSubmit={(data) => updateBranch.mutate({ id: branch.id, data })}
                  />
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Branch</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this branch? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteBranch.mutate(branch.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}