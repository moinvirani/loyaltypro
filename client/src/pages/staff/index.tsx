import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Camera, QrCode, Plus, Minus, User, Award, History, Check, AlertCircle, Download, Share2, X, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Html5Qrcode } from "html5-qrcode";

interface ScanResult {
  success: boolean;
  customer: { id: number; name: string } | null;
  loyaltyType: 'stamps' | 'points' | 'membership';
  previousBalance: number;
  newBalance: number;
  amountAdded: number;
  rewardEarned: boolean;
  rewardMessage?: string;
  maxStamps?: number;
  rewardThreshold?: number;
  passUpdateUrl?: string;
  visitLogged?: boolean;
  totalVisits?: number;
}

interface LookupResult {
  customer: {
    id: number;
    name: string;
    email: string;
    phone?: string;
    totalVisits?: number;
  } | null;
  pass: {
    id: number;
    currentBalance: number;
    lifetimeBalance: number;
    lastUpdated: string;
  };
  card: {
    id: number;
    name: string;
    loyaltyType: 'stamps' | 'points' | 'membership';
    maxStamps: number;
    rewardThreshold?: number;
    rewardDescription?: string;
  } | null;
  recentTransactions: Array<{
    id: number;
    type: string;
    amount: number;
    description?: string;
    createdAt: string;
  }>;
}

export default function StaffPage() {
  const { toast } = useToast();
  const [qrInput, setQrInput] = useState("");
  const [amount, setAmount] = useState(1);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [customerInfo, setCustomerInfo] = useState<LookupResult | null>(null);
  const [mode, setMode] = useState<'scan' | 'lookup'>('scan');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-reader";

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }

      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          setQrInput(decodedText);
          stopCamera();
          toast({
            title: "QR Code Scanned",
            description: "Code captured successfully",
          });
        },
        () => {}
      );

      setCameraActive(true);
    } catch (error: any) {
      console.error("Camera error:", error);
      setCameraError(error.message || "Unable to access camera");
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
    } catch (error) {
      console.error("Error stopping camera:", error);
    }
    setCameraActive(false);
  };

  const scanMutation = useMutation({
    mutationFn: async (data: { qrData: string; amount: number }) => {
      const response = await apiRequest('POST', '/api/staff/scan', data);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to process scan");
      }
      return response.json();
    },
    onSuccess: (data: ScanResult) => {
      setLastScan(data);
      setQrInput("");
      
      if (data.rewardEarned) {
        toast({
          title: "Reward Earned!",
          description: data.rewardMessage || "Customer earned a reward!",
        });
      } else if (data.loyaltyType === 'membership') {
        toast({
          title: "Visit Logged",
          description: `Entry recorded for ${data.customer?.name || 'customer'}. Total visits: ${data.totalVisits || data.newBalance}`,
        });
      } else {
        toast({
          title: "Success",
          description: `Added ${data.amountAdded} ${data.loyaltyType === 'stamps' ? 'stamp(s)' : 'point(s)'} to ${data.customer?.name || 'customer'}`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process scan",
        variant: "destructive",
      });
    }
  });

  const lookupMutation = useMutation({
    mutationFn: async (qrData: string) => {
      const response = await apiRequest('POST', '/api/staff/lookup', { qrData });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to lookup customer");
      }
      return response.json();
    },
    onSuccess: (data: LookupResult) => {
      setCustomerInfo(data);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to lookup customer",
        variant: "destructive",
      });
    }
  });

  const handleScan = () => {
    if (!qrInput.trim()) {
      toast({
        title: "Error",
        description: "Please scan a QR code first",
        variant: "destructive",
      });
      return;
    }
    scanMutation.mutate({ qrData: qrInput.trim(), amount });
  };

  const handleLookup = () => {
    if (!qrInput.trim()) {
      toast({
        title: "Error",
        description: "Please scan a QR code first",
        variant: "destructive",
      });
      return;
    }
    lookupMutation.mutate(qrInput.trim());
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 text-center pr-10">
            <h1 className="text-3xl font-bold">Staff Scanner</h1>
            <p className="text-muted-foreground">Add stamps or points when customers visit</p>
          </div>
        </div>

        <div className="flex gap-2 justify-center">
          <Button 
            variant={mode === 'scan' ? 'default' : 'outline'}
            onClick={() => setMode('scan')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Points
          </Button>
          <Button 
            variant={mode === 'lookup' ? 'default' : 'outline'}
            onClick={() => setMode('lookup')}
          >
            <User className="h-4 w-4 mr-2" />
            Lookup Customer
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {mode === 'scan' ? 'Scan Customer Pass' : 'Customer Lookup'}
            </CardTitle>
            <CardDescription>
              {mode === 'scan' 
                ? 'Use the camera to scan the QR code from the customer\'s wallet pass'
                : 'Look up customer information by scanning their pass'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div 
              id={scannerContainerId} 
              className="w-full aspect-square max-w-sm mx-auto bg-muted rounded-lg overflow-hidden"
              style={{ display: cameraActive ? 'block' : 'none', minHeight: cameraActive ? '300px' : 0 }}
            />

            {cameraError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
                <AlertCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
                <p className="text-sm text-destructive">{cameraError}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Make sure you've granted camera permissions to this site
                </p>
              </div>
            )}

            {!cameraActive && !cameraError && (
              <div className="bg-muted rounded-lg p-8 text-center">
                <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <Button onClick={startCamera} size="lg">
                  <Camera className="h-4 w-4 mr-2" />
                  Start Camera Scanner
                </Button>
              </div>
            )}

            {cameraActive && (
              <Button 
                variant="outline" 
                onClick={stopCamera}
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Stop Camera
              </Button>
            )}

            {qrInput && (
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-700 dark:text-green-300">QR Code Captured</span>
                </div>
                <p className="text-xs font-mono text-muted-foreground truncate">{qrInput}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="qrInput">Or paste QR code manually</Label>
              <Input
                id="qrInput"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="Paste QR code content here"
                className="font-mono text-sm"
              />
            </div>

            {mode === 'scan' && (
              <div className="space-y-2">
                <Label htmlFor="amount">Amount to Add</Label>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setAmount(prev => Math.max(1, prev - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    max="100"
                    value={amount}
                    onChange={(e) => setAmount(parseInt(e.target.value) || 1)}
                    className="w-20 text-center"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setAmount(prev => prev + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <Button 
              onClick={mode === 'scan' ? handleScan : handleLookup}
              disabled={scanMutation.isPending || lookupMutation.isPending || !qrInput}
              className="w-full"
              size="lg"
            >
              {scanMutation.isPending || lookupMutation.isPending ? (
                "Processing..."
              ) : mode === 'scan' ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Add to Customer
                </>
              ) : (
                <>
                  <User className="h-4 w-4 mr-2" />
                  Look Up
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {lastScan && mode === 'scan' && (
          <Card className={lastScan.rewardEarned ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {lastScan.rewardEarned ? (
                  <Award className="h-5 w-5 text-green-500" />
                ) : (
                  <Check className="h-5 w-5 text-primary" />
                )}
                Last Scan Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lastScan.customer && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{lastScan.customer.name}</span>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{lastScan.previousBalance}</div>
                  <div className="text-xs text-muted-foreground">Previous Balance</div>
                </div>
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{lastScan.newBalance}</div>
                  <div className="text-xs text-muted-foreground">New Balance</div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2">
                {lastScan.loyaltyType === 'membership' ? (
                  <Badge variant="secondary">
                    Visit #{lastScan.totalVisits || lastScan.newBalance} Logged
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    +{lastScan.amountAdded} {lastScan.loyaltyType === 'stamps' ? 'stamp(s)' : 'point(s)'}
                  </Badge>
                )}
                {lastScan.loyaltyType === 'stamps' && lastScan.maxStamps && (
                  <Badge variant="outline">
                    {lastScan.newBalance}/{lastScan.maxStamps} stamps
                  </Badge>
                )}
                {lastScan.loyaltyType === 'membership' && (
                  <Badge variant="outline">Membership</Badge>
                )}
              </div>

              {lastScan.rewardEarned && (
                <div className="p-4 bg-green-100 dark:bg-green-900 rounded-lg text-center">
                  <Award className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="font-medium text-green-700 dark:text-green-300">
                    {lastScan.rewardMessage}
                  </p>
                </div>
              )}

              {lastScan.passUpdateUrl && (
                <div className="border-t pt-4 space-y-2">
                  <p className="text-sm text-muted-foreground text-center">
                    Customer can update their wallet pass:
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        const fullUrl = `${window.location.origin}${lastScan.passUpdateUrl}`;
                        navigator.clipboard.writeText(fullUrl);
                        toast({
                          title: "Link Copied",
                          description: "Share this link with the customer to update their wallet pass",
                        });
                      }}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Copy Link
                    </Button>
                    <Button
                      variant="default"
                      className="flex-1"
                      onClick={() => {
                        window.open(lastScan.passUpdateUrl, '_blank');
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Pass
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {customerInfo && mode === 'lookup' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {customerInfo.customer ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{customerInfo.customer.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium">{customerInfo.customer.email}</span>
                    </div>
                    {customerInfo.customer.phone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span className="font-medium">{customerInfo.customer.phone}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Visits</span>
                      <span className="font-medium">{customerInfo.customer.totalVisits || 0}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-primary/10 rounded-lg">
                        <div className="text-2xl font-bold text-primary">
                          {customerInfo.pass.currentBalance}
                        </div>
                        <div className="text-xs text-muted-foreground">Current Balance</div>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold">
                          {customerInfo.pass.lifetimeBalance}
                        </div>
                        <div className="text-xs text-muted-foreground">Lifetime Earned</div>
                      </div>
                    </div>
                  </div>

                  {customerInfo.card && (
                    <div className="flex flex-wrap gap-2">
                      <Badge>{customerInfo.card.name}</Badge>
                      <Badge variant="outline">
                        {customerInfo.card.loyaltyType === 'stamps' ? 'Stamp Card' : 
                         customerInfo.card.loyaltyType === 'points' ? 'Points Card' : 
                         'Membership Card'}
                      </Badge>
                    </div>
                  )}

                  {customerInfo.recentTransactions.length > 0 && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Recent Activity
                      </h4>
                      <div className="space-y-2">
                        {customerInfo.recentTransactions.map((tx) => (
                          <div key={tx.id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {tx.description || `+${tx.amount} ${tx.type}`}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No customer information found</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
