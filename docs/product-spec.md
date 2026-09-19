# Product Spec

## Product Hypothesis

Turn messy vendor responses into a trusted, auditable procurement decision.

## Goal 1 Scope

Goal 1 establishes the procurement foundation only: app shell, RFx data, vendor fixtures, deterministic domain logic, database schema, tests, and documentation. It does not call an AI provider.

## Buyer Journey

Dashboard -> Create / Review RFx -> Vendor Responses -> Quote Comparison -> Exceptions / Evidence -> AI Analyst -> Scenario Analysis -> Human Approval.

Goal 1 implements the first four working screens and placeholder routes for the later screens.

## Dataset

The seeded event is a corrugated packaging RFx with 30 line items and 5 vendors. The fixture data intentionally includes missing prices, missing currency, unknown pack sizes, freight ambiguity, quality failure, missing lead time, partial response, unmapped line item, unit mismatch, and alternate terminology.

## Principle

AI interprets. Code calculates. Database remembers. Evidence explains. Human approves.
