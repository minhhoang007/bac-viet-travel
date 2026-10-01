import { getContainer } from "@/bootstrap/container";
import { createBookingService, type BookingService } from "@/product/booking/service";
import { getTourCatalog } from "@/product/tours/catalog";

let service: BookingService | undefined;

/** Booking service for server pages and actions (profile app). 10 holds / 10 minutes per client. */
export function getBooking(): BookingService {
  if (service) return service;
  const container = getContainer();
  return (service = createBookingService({
    db: container.app!.db,
    logger: container.logger,
    rateLimiter: container.rateLimiter("booking-hold", { max: 10, windowMs: 10 * 60_000 }),
    tourPrice: (slug) => getTourCatalog().get("vi", slug)?.price.vnd ?? null,
  }));
}
