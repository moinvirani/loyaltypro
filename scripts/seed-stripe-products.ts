import { getUncachableStripeClient } from '../server/stripeClient';

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  console.log('Creating LoyaltyPro subscription products...');

  const existingProducts = await stripe.products.search({ query: "name:'LoyaltyPro'" });
  if (existingProducts.data.length > 0) {
    console.log('Products already exist, skipping seed...');
    return;
  }

  const starterProduct = await stripe.products.create({
    name: 'LoyaltyPro Starter',
    description: 'Perfect for small businesses. 1 location, 1 card design, 500 customers.',
    metadata: {
      tier: 'starter',
      locations: '1',
      cardDesigns: '1',
      customers: '500',
      features: 'Apple Wallet,Basic Analytics,Email Support',
    }
  });

  await stripe.prices.create({
    product: starterProduct.id,
    unit_amount: 2900,
    currency: 'aed',
    recurring: { interval: 'month' },
    metadata: { plan: 'starter_monthly' }
  });

  await stripe.prices.create({
    product: starterProduct.id,
    unit_amount: 29000,
    currency: 'aed',
    recurring: { interval: 'year' },
    metadata: { plan: 'starter_yearly', discount: '17%' }
  });

  console.log(`Created: ${starterProduct.name} (${starterProduct.id})`);

  const growthProduct = await stripe.products.create({
    name: 'LoyaltyPro Growth',
    description: 'For growing businesses. 3 locations, 5 card designs, 2,000 customers.',
    metadata: {
      tier: 'growth',
      locations: '3',
      cardDesigns: '5',
      customers: '2000',
      features: 'Apple Wallet,Google Wallet,Push Notifications,Advanced Analytics,Priority Support',
    }
  });

  await stripe.prices.create({
    product: growthProduct.id,
    unit_amount: 7900,
    currency: 'aed',
    recurring: { interval: 'month' },
    metadata: { plan: 'growth_monthly' }
  });

  await stripe.prices.create({
    product: growthProduct.id,
    unit_amount: 79000,
    currency: 'aed',
    recurring: { interval: 'year' },
    metadata: { plan: 'growth_yearly', discount: '17%' }
  });

  console.log(`Created: ${growthProduct.name} (${growthProduct.id})`);

  const enterpriseProduct = await stripe.products.create({
    name: 'LoyaltyPro Enterprise',
    description: 'For large businesses. Unlimited locations, unlimited designs, unlimited customers.',
    metadata: {
      tier: 'enterprise',
      locations: 'Unlimited',
      cardDesigns: 'Unlimited',
      customers: 'Unlimited',
      features: 'Apple Wallet,Google Wallet,Push Notifications,Multi-Stamp Cards,CRM Integration,Dedicated Account Manager,API Access,Custom Branding',
    }
  });

  await stripe.prices.create({
    product: enterpriseProduct.id,
    unit_amount: 19900,
    currency: 'aed',
    recurring: { interval: 'month' },
    metadata: { plan: 'enterprise_monthly' }
  });

  await stripe.prices.create({
    product: enterpriseProduct.id,
    unit_amount: 199000,
    currency: 'aed',
    recurring: { interval: 'year' },
    metadata: { plan: 'enterprise_yearly', discount: '17%' }
  });

  console.log(`Created: ${enterpriseProduct.name} (${enterpriseProduct.id})`);

  console.log('\nAll products created successfully!');
}

seedProducts().catch(console.error);
