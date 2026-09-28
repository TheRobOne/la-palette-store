# Przelewy24 payment provider (placeholder)

This directory is a reserved home for the Przelewy24 payment provider module
required by the constitution ("Payments": BLIK, fast bank transfers, cards,
integrated as a Medusa payment provider module with webhook-based payment
confirmation).

No integration exists yet — this feature (001-project-skeleton) only
establishes the extension point. Implementing it is a separate feature.

A Medusa payment provider module extends
`AbstractPaymentProvider` from `@medusajs/framework/utils` and is registered
under `modules` in `medusa-config.ts` with a `payment` module dependency, as
described in the
[Payment Module Provider guide](https://docs.medusajs.com/resources/references/payment/provider).
