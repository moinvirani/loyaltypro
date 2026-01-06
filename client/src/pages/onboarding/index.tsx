import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Building2, CreditCard, CheckCircle2, Upload, ArrowRight, ArrowLeft, Sparkles, Check, Crown } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";

type Step = "business" | "plan" | "card" | "complete";

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  metadata: {
    tier: string;
    locations: string;
    cardDesigns: string;
    customers: string;
    features: string;
  };
  prices: Price[];
}

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<Step>("business");
  const [selectedPriceId, setSelectedPriceId] = useState<string>("");
  
  const [businessData, setBusinessData] = useState({
    phone: "",
    address: "",
    website: "",
    logo: "" as string,
  });

  const [cardData, setCardData] = useState({
    name: `${user?.name || "My"} Loyalty Card`,
    type: "points" as "stamps" | "points",
  });

  const { data: productsData, isLoading: productsLoading } = useQuery<{ data: Product[] }>({
    queryKey: ['/api/stripe/products'],
  });

  const updateBusinessMutation = useMutation({
    mutationFn: async (data: typeof businessData) => {
      const filteredData: Record<string, string> = {};
      if (data.phone.trim()) filteredData.phone = data.phone.trim();
      if (data.address.trim()) filteredData.address = data.address.trim();
      if (data.website.trim()) filteredData.website = data.website.trim();
      if (data.logo) filteredData.logo = data.logo;
      
      if (Object.keys(filteredData).length === 0) {
        return null;
      }
      
      const res = await apiRequest("PATCH", "/api/business/profile", filteredData);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setCurrentStep("plan");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("POST", "/api/stripe/checkout", { 
        priceId,
        withTrial: true 
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create checkout");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
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

  const createCardMutation = useMutation({
    mutationFn: async (data: typeof cardData) => {
      const res = await apiRequest("POST", "/api/cards", {
        name: data.name,
        type: data.type,
        design: {
          primaryColor: "#6366F1",
          backgroundColor: "#ffffff",
          stampCount: data.type === "stamps" ? 10 : undefined,
          cardStyle: "modern",
        },
        isActive: true,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create card");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      setCurrentStep("complete");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setBusinessData(prev => ({ ...prev, logo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleBusinessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateBusinessMutation.mutate(businessData);
  };

  const handlePlanSelect = () => {
    if (selectedPriceId) {
      checkoutMutation.mutate(selectedPriceId);
    }
  };

  const handleSkipPlan = () => {
    setCurrentStep("card");
  };

  const handleCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCardMutation.mutate(cardData);
  };

  const goToDashboard = () => {
    setLocation("/dashboard");
  };

  const steps = [
    { id: "business", label: "Business Info", icon: Building2 },
    { id: "plan", label: "Choose Plan", icon: Crown },
    { id: "card", label: "First Card", icon: CreditCard },
    { id: "complete", label: "Complete", icon: CheckCircle2 },
  ];

  const tierOrder = ['starter', 'growth', 'enterprise'];
  const sortedProducts = productsData?.data?.sort((a, b) => {
    const aIndex = tierOrder.indexOf(a.metadata?.tier || '');
    const bIndex = tierOrder.indexOf(b.metadata?.tier || '');
    return aIndex - bIndex;
  }) || [];

  const getMonthlyPrice = (product: Product) => {
    return product.prices?.find(p => p.recurring?.interval === 'month');
  };

  const formatPrice = (amount: number, currency: string) => {
    const formatted = (amount / 100).toFixed(0);
    return currency.toUpperCase() === 'AED' ? `${formatted} AED` : `$${formatted}`;
  };

  const getPlanFeatures = (product: Product) => {
    const features: string[] = [];
    if (product.metadata?.cardDesigns) {
      features.push(`${product.metadata.cardDesigns} card design${product.metadata.cardDesigns === '1' ? '' : 's'}`);
    }
    if (product.metadata?.customers) {
      features.push(`${product.metadata.customers} customers`);
    }
    if (product.metadata?.locations) {
      features.push(`${product.metadata.locations} location${product.metadata.locations === '1' ? '' : 's'}`);
    }
    if (product.metadata?.features) {
      features.push(...product.metadata.features.split(',').map(f => f.trim()));
    }
    return features;
  };

  const stepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to LoyaltyPro!</h1>
          <p className="text-gray-600 mt-2">Let's set up your business in just a few steps</p>
        </div>

        <div className="flex justify-center mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  currentStep === step.id
                    ? "bg-indigo-600 text-white"
                    : stepIndex > index
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                <step.icon className="h-5 w-5" />
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-8 sm:w-12 h-1 mx-1 sm:mx-2 ${
                    stepIndex > index
                      ? "bg-green-500"
                      : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {currentStep === "business" && (
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>
                Add some details about your business (optional, you can update these later)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBusinessSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Business Logo</Label>
                  <div className="flex items-center gap-4">
                    {businessData.logo ? (
                      <img
                        src={businessData.logo}
                        alt="Logo preview"
                        className="w-16 h-16 rounded-lg object-cover border"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center border">
                        <Building2 className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <Label htmlFor="logo-upload" className="cursor-pointer">
                        <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-gray-50 text-sm">
                          <Upload className="h-4 w-4" />
                          Upload Logo
                        </div>
                      </Label>
                      <Input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+971 50 123 4567"
                    value={businessData.phone}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Business Address</Label>
                  <Input
                    id="address"
                    placeholder="Dubai, UAE"
                    value={businessData.address}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://yourbusiness.com"
                    value={businessData.website}
                    onChange={(e) => setBusinessData(prev => ({ ...prev, website: e.target.value }))}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setCurrentStep("plan")}
                  >
                    Skip for now
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={updateBusinessMutation.isPending}
                  >
                    {updateBusinessMutation.isPending ? "Saving..." : "Continue"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {currentStep === "plan" && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-2">
                <Sparkles className="h-6 w-6 text-indigo-600" />
              </div>
              <CardTitle>Choose Your Plan</CardTitle>
              <CardDescription>
                Start with a <span className="font-semibold text-indigo-600">14-day free trial</span> - no credit card required upfront
              </CardDescription>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : sortedProducts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Plans are being set up. You can skip this step for now.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedProducts.map((product) => {
                    const monthlyPrice = getMonthlyPrice(product);
                    const isSelected = selectedPriceId === monthlyPrice?.id;
                    const features = getPlanFeatures(product);
                    const isPopular = product.metadata?.tier === 'growth';

                    return (
                      <div
                        key={product.id}
                        className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-indigo-600 bg-indigo-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => monthlyPrice && setSelectedPriceId(monthlyPrice.id)}
                      >
                        {isPopular && (
                          <Badge className="absolute -top-2.5 left-4 bg-indigo-600">
                            Most Popular
                          </Badge>
                        )}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{product.name}</h3>
                            {product.description && (
                              <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-3">
                              {features.slice(0, 3).map((feature, idx) => (
                                <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                  {feature}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            {monthlyPrice ? (
                              <>
                                <div className="text-2xl font-bold">
                                  {formatPrice(monthlyPrice.unit_amount, monthlyPrice.currency)}
                                </div>
                                <div className="text-xs text-muted-foreground">/month</div>
                              </>
                            ) : (
                              <div className="text-muted-foreground">Custom</div>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="absolute top-4 right-4">
                            <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                              <Check className="h-4 w-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3 pt-6 border-t mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep("business")}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={handleSkipPlan}
                >
                  Skip for now
                </Button>
                <Button 
                  onClick={handlePlanSelect}
                  disabled={!selectedPriceId || checkoutMutation.isPending}
                  className="flex-1"
                >
                  {checkoutMutation.isPending ? "Processing..." : "Start Free Trial"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === "card" && (
          <Card>
            <CardHeader>
              <CardTitle>Create Your First Loyalty Card</CardTitle>
              <CardDescription>
                Set up a loyalty program to reward your customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCardSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="cardName">Card Name</Label>
                  <Input
                    id="cardName"
                    placeholder="My Loyalty Card"
                    value={cardData.name}
                    onChange={(e) => setCardData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-3">
                  <Label>Loyalty Type</Label>
                  <RadioGroup
                    value={cardData.type}
                    onValueChange={(value) => setCardData(prev => ({ ...prev, type: value as "stamps" | "points" }))}
                  >
                    <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <RadioGroupItem value="stamps" id="stamps" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="stamps" className="font-medium cursor-pointer">Stamp Card</Label>
                        <p className="text-sm text-gray-500 mt-1">
                          Perfect for coffee shops and restaurants. Customers collect stamps and earn a free item after 10 visits.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <RadioGroupItem value="points" id="points" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="points" className="font-medium cursor-pointer">Points Card</Label>
                        <p className="text-sm text-gray-500 mt-1">
                          Great for service businesses. Customers earn points based on spending and redeem them for discounts.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep("plan")}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={createCardMutation.isPending}
                  >
                    {createCardMutation.isPending ? "Creating..." : "Create Card"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {currentStep === "complete" && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl">You're All Set!</CardTitle>
              <CardDescription>
                Your loyalty program is ready. Start adding customers and growing your business.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium">Next steps:</h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Customize your card design in the Card Designer
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Add your first customer to start issuing loyalty cards
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Use the Staff Scanner to add stamps or points during visits
                  </li>
                </ul>
              </div>

              <Button onClick={goToDashboard} className="w-full" size="lg">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
