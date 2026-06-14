import { NotImplementedError } from "../errors";
import type {
  LinkedAccount,
  LinkedAccountInput,
  OnboardingLink,
  RouteAccountStatus,
  RouteOnboarding,
} from "./types";

/**
 * Compile-safe stub for Razorpay Route account onboarding. Implements the full
 * RouteOnboarding interface so the future rollout is a single-file change, but
 * every method throws NotImplementedError — Route onboarding is not live and
 * nothing calls these yet. This is preparation, not behaviour.
 */
export class RouteOnboardingService implements RouteOnboarding {
  async createLinkedAccount(_input: LinkedAccountInput): Promise<LinkedAccount> {
    throw new NotImplementedError("RouteOnboardingService.createLinkedAccount");
  }

  async getAccountStatus(_routeAccountId: string): Promise<RouteAccountStatus> {
    throw new NotImplementedError("RouteOnboardingService.getAccountStatus");
  }

  async generateOnboardingLink(_routeAccountId: string): Promise<OnboardingLink> {
    throw new NotImplementedError("RouteOnboardingService.generateOnboardingLink");
  }
}
