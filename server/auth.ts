import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { businesses, insertBusinessSchema, type Business } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";
import MemoryStore from "memorystore";

declare global {
  namespace Express {
    interface User extends Business {}
  }
}

const scryptAsync = promisify(scrypt);
const SessionStore = MemoryStore(session);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

async function getBusinessByEmail(email: string) {
  return db.select().from(businesses).where(eq(businesses.email, email)).limit(1);
}

export function setupAuth(app: Express) {
  if (!process.env.SESSION_SECRET) {
    console.warn("Warning: SESSION_SECRET not set. Using temporary secret for development.");
  }
  
  const isProduction = process.env.NODE_ENV === "production";
  
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "dev-only-secret-" + Date.now(),
    resave: false,
    saveUninitialized: false,
    store: new SessionStore({
      checkPeriod: 86400000,
    }),
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: isProduction ? "strict" : "lax",
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password' },
      async (email, password, done) => {
        try {
          const [business] = await getBusinessByEmail(email);
          if (!business) {
            return done(null, false, { message: 'Invalid email or password' });
          }
          
          const isValidPassword = await comparePasswords(password, business.password);
          if (!isValidPassword) {
            return done(null, false, { message: 'Invalid email or password' });
          }
          
          return done(null, business);
        } catch (error) {
          return done(error);
        }
      }
    ),
  );

  passport.serializeUser((business, done) => done(null, business.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, id))
        .limit(1);
      done(null, business || null);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { name, email, password } = req.body;
      
      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const [existingBusiness] = await getBusinessByEmail(email);
      if (existingBusiness) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const [business] = await db
        .insert(businesses)
        .values({
          name,
          email,
          password: await hashPassword(password),
        })
        .returning();

      req.login(business, (err) => {
        if (err) return next(err);
        const { password: _, ...safeData } = business;
        res.status(201).json(safeData);
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Failed to register" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, business: Business | false, info: any) => {
      if (err) return next(err);
      if (!business) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(business, (err) => {
        if (err) return next(err);
        const { password: _, ...safeData } = business;
        res.status(200).json(safeData);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.sendStatus(401);
    }
    const { password: _, ...safeData } = req.user;
    res.json(safeData);
  });
}
