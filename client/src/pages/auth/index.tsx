import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Smartphone, Shield, BarChart3 } from "lucide-react";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ name: "", email: "", password: "" });

  if (user) {
    setLocation("/dashboard");
    return null;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginData);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(registerData);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Welcome to LoyaltyPro</CardTitle>
            <CardDescription>
              Sign in to manage your loyalty cards and customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@business.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Business Name</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Your Business Name"
                      value={registerData.name}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="you@business.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Create a password (min 6 characters)"
                      value={registerData.password}
                      onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      <div className="hidden lg:flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 p-12">
        <div className="max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">Digital Loyalty Cards</h2>
            <p className="text-muted-foreground">
              Create beautiful loyalty cards that live in your customers' Apple Wallet
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg bg-background/50">
              <CreditCard className="h-6 w-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold">Custom Card Design</h3>
                <p className="text-sm text-muted-foreground">
                  Design branded cards with your logo and colors
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-4 rounded-lg bg-background/50">
              <Smartphone className="h-6 w-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold">Apple Wallet Integration</h3>
                <p className="text-sm text-muted-foreground">
                  Cards live right next to credit cards
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-4 rounded-lg bg-background/50">
              <Shield className="h-6 w-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold">Easy Staff Scanning</h3>
                <p className="text-sm text-muted-foreground">
                  Scan QR codes to add points or stamps
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-4 rounded-lg bg-background/50">
              <BarChart3 className="h-6 w-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold">Real-Time Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  Track customer engagement and growth
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
