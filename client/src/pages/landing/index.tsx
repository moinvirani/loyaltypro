import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  CreditCard, 
  Smartphone, 
  BarChart3, 
  Bell, 
  Users, 
  Store, 
  CheckCircle2, 
  ArrowRight,
  Zap,
  Shield,
  Globe,
  Star,
  ChevronRight
} from "lucide-react";
import { SiApple, SiGoogle } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
  metadata: { discount?: string };
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

const features = [
  {
    icon: CreditCard,
    title: "Digital Loyalty Cards",
    description: "Create beautiful, branded loyalty cards that customers love. No more paper punch cards."
  },
  {
    icon: Smartphone,
    title: "Wallet Integration",
    description: "Cards live in Apple Wallet and Google Wallet, always accessible next to credit cards."
  },
  {
    icon: Bell,
    title: "Push Notifications",
    description: "Send instant notifications directly to your customers' lock screens."
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description: "Track customer engagement, redemptions, and growth with powerful dashboards."
  },
  {
    icon: Users,
    title: "Customer CRM",
    description: "Manage customer data, segments, and personalize their experience."
  },
  {
    icon: Store,
    title: "Multi-Location",
    description: "Perfect for businesses with multiple branches. Manage all locations from one dashboard."
  }
];

const testimonials = [
  {
    name: "Ahmed Al-Rashid",
    business: "Dubai Coffee Roasters",
    quote: "Our customer retention increased by 40% within 3 months of using LoyaltyPro.",
    rating: 5
  },
  {
    name: "Sarah Khan",
    business: "Bloom Beauty Spa",
    quote: "The Apple Wallet integration is seamless. Our clients love not having to carry physical cards.",
    rating: 5
  },
  {
    name: "Mohammed Hassan",
    business: "ISF Sports Club",
    quote: "Push notifications have transformed how we engage with our members. Game changer!",
    rating: 5
  }
];

const stats = [
  { value: "50K+", label: "Active Cards" },
  { value: "500+", label: "Businesses" },
  { value: "2M+", label: "Transactions" },
  { value: "99.9%", label: "Uptime" }
];

export default function Landing() {
  const [isYearly, setIsYearly] = useState(false);

  const { data: productsData, isLoading: productsLoading } = useQuery<{ data: Product[] }>({
    queryKey: ['/api/stripe/products'],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const response = await apiRequest('POST', '/api/stripe/checkout', { priceId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    }
  });

  const getPrice = (product: Product) => {
    const prices = product.prices || [];
    const targetInterval = isYearly ? 'year' : 'month';
    return prices.find(p => p.recurring?.interval === targetInterval);
  };

  const formatPrice = (amount: number, currency: string) => {
    const formatted = (amount / 100).toFixed(0);
    return currency.toUpperCase() === 'AED' ? `${formatted} AED` : `$${formatted}`;
  };

  const tierOrder = ['starter', 'growth', 'enterprise'];
  const sortedProducts = productsData?.data?.sort((a, b) => {
    const aIndex = tierOrder.indexOf(a.metadata?.tier || '');
    const bIndex = tierOrder.indexOf(b.metadata?.tier || '');
    return aIndex - bIndex;
  }) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl">LoyaltyPro</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition">Features</a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition">Pricing</a>
              <a href="#testimonials" className="text-sm text-muted-foreground hover:text-foreground transition">Testimonials</a>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/dashboard">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge variant="outline" className="mb-6 px-4 py-1.5">
                <Zap className="h-3 w-3 mr-1" />
                Trusted by 500+ UAE Businesses
              </Badge>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight"
            >
              Digital Loyalty Cards That Live in Your{" "}
              <span className="text-primary">Customer's Wallet</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto"
            >
              Replace paper punch cards with beautiful digital loyalty cards. 
              Integrated with Apple Wallet & Google Wallet for instant access.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/dashboard">
                <Button size="lg" className="text-lg px-8 h-14">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <a href="#pricing">
                <Button size="lg" variant="outline" className="text-lg px-8 h-14">
                  View Pricing
                </Button>
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-8 flex items-center justify-center gap-6 text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <SiApple className="h-5 w-5" />
                <span className="text-sm">Apple Wallet</span>
              </div>
              <div className="flex items-center gap-2">
                <SiGoogle className="h-5 w-5" />
                <span className="text-sm">Google Wallet</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <span className="text-sm">Secure & Reliable</span>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-16 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10" />
            <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl p-8 shadow-2xl border">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
                    <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">Everything You Need to Grow</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              A complete loyalty platform designed for modern businesses
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">Simple, Transparent Pricing</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your business. All plans include a 7-day free trial.
            </p>

            <div className="mt-8 flex items-center justify-center gap-4">
              <span className={`text-sm ${!isYearly ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>Monthly</span>
              <Switch checked={isYearly} onCheckedChange={setIsYearly} />
              <span className={`text-sm ${isYearly ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                Yearly <Badge variant="secondary" className="ml-1">Save 17%</Badge>
              </span>
            </div>
          </div>

          {productsLoading ? (
            <div className="grid md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="space-y-4">
                    <div className="h-6 bg-muted rounded w-1/2" />
                    <div className="h-10 bg-muted rounded w-3/4" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className="h-4 bg-muted rounded" />
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-8">
              {sortedProducts.map((product, index) => {
                const price = getPrice(product);
                const isPopular = product.metadata?.tier === 'growth';
                const featuresList = product.metadata?.features?.split(',') || [];

                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <Card className={`relative h-full flex flex-col ${isPopular ? 'border-primary shadow-lg scale-105' : ''}`}>
                      {isPopular && (
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                          Most Popular
                        </Badge>
                      )}
                      <CardHeader>
                        <CardTitle>{product.name?.replace('LoyaltyPro ', '')}</CardTitle>
                        <CardDescription>{product.description}</CardDescription>
                        <div className="mt-4">
                          <span className="text-4xl font-bold">
                            {price ? formatPrice(price.unit_amount, price.currency) : 'Contact Us'}
                          </span>
                          {price && (
                            <span className="text-muted-foreground">
                              /{isYearly ? 'year' : 'month'}
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <ul className="space-y-3">
                          <li className="flex items-center gap-2 text-sm">
                            <Store className="h-4 w-4 text-primary" />
                            {product.metadata?.locations} Location{product.metadata?.locations !== '1' ? 's' : ''}
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <CreditCard className="h-4 w-4 text-primary" />
                            {product.metadata?.cardDesigns} Card Design{product.metadata?.cardDesigns !== '1' ? 's' : ''}
                          </li>
                          <li className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-primary" />
                            {product.metadata?.customers} Customers
                          </li>
                          <div className="border-t my-4 pt-4">
                            {featuresList.map((feature, i) => (
                              <li key={i} className="flex items-center gap-2 text-sm mb-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                {feature.trim()}
                              </li>
                            ))}
                          </div>
                        </ul>
                      </CardContent>
                      <CardFooter>
                        <Button
                          className="w-full"
                          variant={isPopular ? 'default' : 'outline'}
                          onClick={() => price && checkoutMutation.mutate(price.id)}
                          disabled={!price || checkoutMutation.isPending}
                        >
                          {checkoutMutation.isPending ? 'Loading...' : 'Start Free Trial'}
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold">Loved by Businesses</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              See what our customers are saying about LoyaltyPro
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full">
                  <CardContent className="pt-6">
                    <div className="flex gap-1 mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-6">"{testimonial.quote}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-primary font-semibold">
                          {testimonial.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">{testimonial.name}</div>
                        <div className="text-sm text-muted-foreground">{testimonial.business}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold">Ready to Grow Your Business?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start your 7-day free trial today. No credit card required.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard">
              <Button size="lg" className="text-lg px-8 h-14">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-lg px-8 h-14">
              <Globe className="mr-2 h-5 w-5" />
              Schedule Demo
            </Button>
          </div>
        </div>
      </section>

      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl">LoyaltyPro</span>
            </div>
            <div className="text-sm text-muted-foreground">
              © 2025 LoyaltyPro. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Privacy</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Terms</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
