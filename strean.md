Shopper Recommendation Candidate Platform

Requirements and AWS implementation proposal

Status: Proposal
Audience: Shopping architecture, product, engineering, data, and machine learning
Decision requested: Approve the platform boundary and a replay-based proof of concept before committing to a production build.

Executive summary

Shopping should build a shared platform that returns a high-recall set of eligible, deduplicated product and offer candidates for a shopper and placement. Email, Feed, Push, and future surfaces should consume that set while retaining control of final ranking, channel policy, creative, and the decision to show nothing.

The platform should own reusable discovery work: retrieval, canonical product identity, offer association, global eligibility, deduplication, inexpensive coarse pruning, provenance, and feedback linkage. It should not own one universal relevance model. Each surface has a different objective and customer cost, so final ordering must remain surface-owned even if the models run on shared infrastructure.

Product identity and offer state must remain distinct. A canonical product is normally the deduplication and diversity unit; merchant offers remain purchasable children with price, inventory, promotion, fulfillment, and customer eligibility. The system must also support offer-first triggers such as a meaningful price drop.

On AWS, the recommended implementation uses:

• Amazon Kinesis and an S3/Iceberg lake for durable event history and replay
• Amazon OpenSearch Service and DynamoDB for retrieval
• DynamoDB, ElastiCache, and an approved feature platform for low-latency state
• ECS on Fargate, or an existing enterprise EKS platform, for the online coordinator
• EventBridge or Kinesis for triggered execution
• Step Functions with EMR Serverless or AWS Glue for batch generation
• SageMaker where it adds value for training, registry, batch inference, and real-time inference

Online, triggered, and batch paths should share contracts, rule versions, identity mappings, feature definitions, provenance, and evaluation logic. They should not be forced through one synchronous runtime.

────────

1. Requirements

1.1 Problem statement

Shopping has several experiences that choose products or offers for a shopper. Those experiences can reuse much of the same product discovery, identity resolution, eligibility, and feature work. Rebuilding those capabilities separately for Email, Feed, Push, and each future surface creates duplicated cost, inconsistent policy enforcement, and fragmented learning.

The final customer decision cannot be fully centralized. Each surface has a different context, interaction model, objective, and customer cost. Email may optimize expected incremental conversion subject to fatigue and send policy. Feed may optimize session value and discovery. Push must account for interruption cost. A common candidate pool can serve all three, but one universal final ordering cannot.

The required boundary is therefore:

> Given a shopper reference, placement context, constraints, and execution budget, the platform must return a bounded set of eligible, canonicalized product or offer candidates with enough context for a surface-owned ranker to make the final decision.

The decomposition follows a mature recommendation pattern: broad retrieval, early canonicalization and deduplication, hard filtering, inexpensive pruning, surface-specific ranking, and late presentation hydration. Uber describes a comparable separation in its search pipeline. That is supporting precedent, not a template or dependency for this requirement.

1.2 Scope

In scope

• Candidate retrieval from multiple independently owned sources
• Canonical product identity and merchant-offer association
• Global hard eligibility and invariant policy enforcement
• Deduplication and recall-preserving coarse pruning
• Versioned contracts for online, triggered, and batch consumers
• Candidate provenance, ranking features, and reason codes
• Feedback attribution, experimentation, and offline evaluation
• Graceful degradation when an optional arm or dependency fails
• A shared model-serving runtime when useful, while preserving surface ownership of objectives and configurations

Out of scope

• One universal final ordering shared by every surface
• Email creative, Feed rendering, or Push copy generation
• Channel-specific contact policy and frequency caps unless they are globally invariant
• Replacing catalog, offer, customer, or policy systems of record
• Requiring batch workloads to call the online API once per shopper
• Requiring generative AI in the online decision path

1.3 Logical pipeline

The platform should execute the following stages in order:

1. Validate shopper identity, placement context, constraints, and budget.
2. Activate the retrieval arms configured for that placement.
3. Run arms concurrently within independent quotas and deadlines.
4. Resolve source identifiers and merchant SKUs to canonical product identities.
5. Merge duplicate contributions while retaining every source, score, and reason.
6. Attach purchasable offers and enforce global hard eligibility.
7. Apply per-arm and per-category quotas where needed to protect coverage.
8. Apply inexpensive coarse scoring and diversity-aware pruning.
9. Return a bounded candidate set with provenance, versions, and freshness metadata.
10. Allow the surface ranker and policy layer to select, reorder, or reject every candidate.
11. Hydrate presentation data only for the small final set.

Coarse scoring is a cost-control mechanism. It is not the final customer decision.

1.4 Retrieval arms

Retrieval should be a pluggable fan-out, not one model. An arm earns its place by contributing winners, coverage, or useful exploration that other arms do not provide.

|Arm                 |Primary inputs                                             |Role                                  |
|--------------------|-----------------------------------------------------------|--------------------------------------|
|Recent intent       |Recent views, searches, clicks, and saves                  |Short-term shopper intent             |
|Long-term affinity  |Category, brand, merchant, and price-band affinity         |Stable preferences                    |
|Semantic similarity |Embedding similarity to engaged products or inferred intent|Related products beyond exact taxonomy|
|Collaborative       |Precomputed neighbor or co-engagement lists                |Behavioral discovery                  |
|Deal and price event|Offer quality, price movement, and promotion strength      |Time-sensitive value                  |
|Replenishment       |Predicted repeat-purchase timing                           |Recurring needs                       |
|Trending and popular|Locale, category, and cohort popularity                    |Cold-start and recency coverage       |
|Editorial           |Approved seasonal, campaign, or strategic candidates       |Intentional business input            |

For every arm, measure candidate count, latency, overlap, unique contribution to eventual winners, downstream selection rate, and cost. Remove or narrow arms whose cost is not justified by unique value.

1.5 Product and offer semantics

The canonical product should normally be the deduplication and diversity unit. Offers remain children of the product and carry merchant, price, shipping, promotion, availability, and customer eligibility. This prevents several listings for the same item from crowding out other products.

The contract must also support an offer-first candidate. A price drop, expiring benefit, or merchant-specific promotion can be the reason to contact the shopper. In that case the candidate type is OFFER, but it still references a canonical product.

```text
CandidateIdentity
  candidate_type       PRODUCT | OFFER
  canonical_product_id stable shopper-product identity
  eligible_offer_ids   current purchasable propositions
  primary_offer_id     optional offer that caused retrieval
  identity_version     mapping version used for deduplication
```

1.6 Eligibility and policy boundary

The platform must separate rules that no surface may override from decisions that depend on the surface.

|Class                  |Examples                                                                                                                                       |Owner                                    |
|-----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------|
|Global hard eligibility|Availability, geography or customer restriction, expired promotion, unsafe or restricted catalog entity, merchant exclusion, global suppression|Candidate platform                       |
|Surface policy         |Frequency cap, recently seen logic, interruption threshold, category or merchant concentration, campaign policy, creative compatibility        |Surface after ranking or during reranking|
|Preference signal      |Deal strength, merchant affinity, novelty, diversity, expected value                                                                           |Surface model or reranker                |

If the system cannot verify a hard eligibility rule, it must fail closed for the affected candidate. Optional preference features may fall back to defaults only when the degradation is recorded.

1.7 Ownership

|Owner                   |Accountability                                                                                                                      |
|------------------------|------------------------------------------------------------------------------------------------------------------------------------|
|Candidate platform      |Discovery, identity resolution, retrieval, global eligibility, deduplication, coarse pruning, provenance, contracts, and reliability|
|Surface team            |Business objective, final ranking, diversity and pacing, channel policy, creative, placement, and no-placement decision             |
|Shared ranking platform |Feature access, training and serving machinery, registry, experimentation, deployment, and observability                            |
|Catalog and offer owners|Authoritative product, merchant, price, inventory, promotion, and fulfillment state                                                 |
|Data and ML governance  |Data-use approval, retention, lineage, model validation, and customer rights                                                        |

The boundary should be enforced in both the API and governance model. A surface may request constraints and a candidate budget but may not add final-ordering logic to the shared candidate service. A retrieval arm may add candidates and features but may not bypass global eligibility.

1.8 Contracts

The following examples show the logical contract. Exact field names and serialization should be finalized during detailed design.

Candidate request

```json
{
  "request_id": "...",
  "shopper_ref": "tokenized-internal-reference",
  "surface": "EMAIL | FEED | PUSH | OTHER",
  "placement": "HOME_FEED | WEEKLY_DEALS | PRICE_ALERT | ...",
  "mode": "ONLINE | TRIGGERED | BATCH",
  "intent": "DISCOVER | DEAL | REPLENISH | REENGAGE",
  "context": {
    "locale": "...",
    "region": "...",
    "device": "...",
    "session_ref": "...",
    "trigger_event_ref": "..."
  },
  "constraints": {
    "category_ids": [],
    "merchant_ids": [],
    "price": {},
    "promotion_required": false
  },
  "budget": {
    "max_candidates": 200,
    "max_latency_ms": 300,
    "freshness_class": "INTERACTIVE"
  },
  "experiment_context": {}
}
```

placement is required because surface alone is not specific enough. A weekly discovery email and a price alert are both Email, but should activate different arms, quotas, and freshness requirements.

Candidate response

```json
{
  "candidate_set_id": "...",
  "generated_at": "...",
  "expires_at": "...",
  "partial_success": false,
  "timed_out_arms": [],
  "versions": {
    "catalog": "...",
    "identity": "...",
    "eligibility": "...",
    "features": "...",
    "coarse_model": "..."
  },
  "experiment_assignments": {},
  "candidates": [
    {
      "candidate_type": "PRODUCT",
      "canonical_product_id": "...",
      "eligible_offer_ids": [],
      "primary_offer_id": null,
      "retrieval_sources": [],
      "retrieval_scores": {},
      "coarse_score": 0.0,
      "reason_codes": [],
      "ranking_features_or_ref": {}
    }
  ]
}
```

Presentation fields are deliberately absent. Images, display copy, formatted price, badges, legal text, and deep links should be retrieved only for selected items.

Outcome event

Every impression, click, dismissal, send, open, and purchase must retain candidate_set_id, shopper reference, surface, placement, position, canonical product, offer, retrieval sources, model version, experiment assignments, event time, and attribution window.

Feedback must preserve surface and placement context. An email open, Feed impression, Push dismissal, and purchase are different observations and should not be collapsed into one generic click-through metric.

1.9 Execution modes

|Mode     |Typical use                                |Physical behavior                                                                   |Expected freshness|
|---------|-------------------------------------------|------------------------------------------------------------------------------------|------------------|
|Online   |Interactive Feed or request-time placement |Low-latency API with strict per-arm deadlines and cached fallbacks                  |Seconds to minutes|
|Triggered|Price drop, replenishment, or another event|Event consumer invokes retrieval and ranking, then applies contact policy           |Seconds to minutes|
|Batch    |Scheduled email campaign or large cohort   |Distributed job applies the same semantics to a snapshot and writes versioned output|Minutes to hours  |

The logical contract does not require one physical API. Large campaigns should run against versioned snapshots rather than issuing millions of synchronous calls to the online coordinator.

1.10 Functional requirements

|ID   |Requirement                                                                                                           |
|-----|----------------------------------------------------------------------------------------------------------------------|
|FR-01|Accept shopper, surface, placement, intent, trigger, constraints, budget, and experiment context.                     |
|FR-02|Run configured retrieval arms concurrently with independent quotas, deadlines, and failure policies.                  |
|FR-03|Resolve source identifiers and merchant SKUs to a versioned canonical product identity before final deduplication.    |
|FR-04|Represent products separately from purchasable offers and support offer-first candidates.                             |
|FR-05|Remove expired, unavailable, restricted, suppressed, or otherwise ineligible candidates before returning them.        |
|FR-06|Reduce candidate volume using inexpensive features or a lightweight model while protecting downstream winner recall.  |
|FR-07|Return no more than the requested maximum and enforce a service-side safety limit.                                    |
|FR-08|Return sources, scores, reason codes, and rule, model, catalog, identity, and feature versions.                       |
|FR-09|Return generation, expiration, and source-state freshness metadata.                                                   |
|FR-10|Return a usable partial result when optional arms time out and identify omissions.                                    |
|FR-11|Allow an authorized evaluator to reconstruct a historical request from as-of data and versioned artifacts.            |
|FR-12|Link impressions and outcomes to the exact candidate set and experimental assignments.                                |
|FR-13|Support independent experiments for retrieval arms, candidate policy, and surface ranking.                            |
|FR-14|Allow the surface to reject all candidates without treating the result as a platform failure.                         |
|FR-15|Defer presentation hydration until the surface selects a small final set.                                             |
|FR-16|Evolve request, response, event, rule, and model artifacts without requiring simultaneous deployment by all consumers.|

1.11 Nonfunctional requirements

The following latency and availability values are review targets, not inherited commitments. Replace them with surface-backed SLOs after traffic, dependency, and failure budgets are known.

|Area          |Requirement                                                                                                                                        |
|--------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
|Latency       |Initial online target: candidate-generation p95 at or below 150 ms and p99 at or below 300 ms, excluding the surface ranker.                       |
|Availability  |Initial online target: 99.95% monthly availability, permitting partial results when optional arms fail.                                            |
|Freshness     |Price, inventory, offer, and suppression state must meet declared freshness classes. Search indexes are not authoritative for volatile eligibility.|
|Scale         |Online, triggered, and batch workloads scale independently. Batch campaigns cannot consume interactive capacity.                                   |
|Consistency   |A candidate set uses stable identity, eligibility, feature, experiment, and model versions.                                                        |
|Idempotency   |Triggered and batch requests are safe to retry using request, campaign, shopper, and snapshot identifiers.                                         |
|Privacy       |Direct customer identifiers, contact data, and unnecessary sensitive attributes are excluded from retrieval indexes and logs.                      |
|Security      |Encrypt in transit and at rest; use least-privilege roles, private network paths, and auditable access.                                            |
|Explainability|Reconstruct why an item entered, survived, and left the pipeline using versioned reasons and drop codes.                                           |
|Cost          |Attribute infrastructure and inference cost by execution mode, placement, arm, and thousand candidate sets.                                        |
|Compatibility |Use additive schema evolution and published deprecation windows.                                                                                   |
|Deletion      |Propagate customer deletion and data-use restrictions through features, snapshots, indexes, and training data.                                     |

1.12 Required metrics

• Retrieval quality: recall at N, historical-winner recall, arm unique contribution, catalog coverage, and cold-start coverage
• Set quality: duplicate collapse, category and brand diversity, novelty, and offer density
• Eligibility: filtered counts by reason, stale-state rate, invalid escape rate, and post-selection rejection rate
• Runtime: end-to-end and per-arm p50/p95/p99 latency, timeouts, errors, partial-success rate, and cache hit rate
• Downstream: surface selection rate, rank changes, no-placement rate, impressions, clicks, dismissals, sends, opens, and purchases
• Economics: cost per thousand candidate sets, per selected candidate, per arm, and for model inference and indexing
• Operations: index lag, feature lag, rule and model versions, replay success, and artifact lineage

1.13 Validation and acceptance

The first proof should evaluate retrieval without replacing production ranking.

For each historical shopper and decision time:

1. Reconstruct only the information available at that time.
2. Run the proposed arms against historical or as-of snapshots.
3. Canonicalize, filter, deduplicate, and generate candidate sets at several values of N.
4. Measure whether historical winners and relevant alternatives appear in each set.
5. Measure arm overlap, unique contribution, duplicate collapse, stale state, and feature cost.
6. Compare candidate overlap and final-ordering differences between Email and Feed.

The most important outputs are the candidate-count-to-recall curve, unique winner contribution by arm, and cross-surface overlap. Strong shared recall with different final ordering supports the proposed boundary. Low overlap suggests the abstraction is too broad or the placement context is underspecified.

Proposed acceptance gates:

|Gate                |Evidence required                                                                                                               |
|--------------------|--------------------------------------------------------------------------------------------------------------------------------|
|Shared recall       |At the agreed candidate budget, retain at least 95% of the current-system winner recall for each pilot surface.                 |
|Eligibility         |No material regression in invalid or suppressed-item escape rate; complete drop-reason attribution.                             |
|Surface independence|Email and Feed apply different ordering and produce measurably different top selections from the shared set.                    |
|Identity value      |Canonicalization materially reduces duplicate merchant-SKU density without a material quality regression.                       |
|Operational fit     |The online path meets its agreed SLO in shadow traffic and batch meets its completion window without affecting online capacity. |
|Economic fit        |Unit cost is attributable and the platform avoids full presentation hydration or expensive inference over the raw retrieval set.|

The 95% recall threshold is a starting proposal. Confirm the candidate budget, baseline, attribution window, and acceptable quality movement before the proof begins.

────────

2. AWS implementation

2.1 Architecture principles

1. Keep the online coordinator stateless and independently scalable.
2. Separate online, triggered, and batch compute and quotas.
3. Share schemas, configurations, rules, identity mappings, and evaluation logic across modes.
4. Treat systems of record as eligibility truth; use indexes for retrieval, not volatile authority.
5. Make every decision reproducible from versioned data and artifacts.
6. Keep presentation hydration out of broad candidate generation.
7. Prefer managed services, private networking, least privilege, and existing enterprise standards.

2.2 Recommended AWS service mapping

|Capability                  |Recommended AWS choice                                                                         |Purpose                                                                                  |
|----------------------------|-----------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
|Event ingestion             |Amazon Kinesis Data Streams                                                                    |Durable shopper, catalog, offer, campaign, and outcome streams with independent consumers|
|Lake and snapshots          |Amazon S3 with Apache Iceberg tables and AWS Glue Data Catalog                                 |Replay, training, batch input, as-of snapshots, and auditable history                    |
|Lake governance             |AWS Lake Formation, IAM, KMS, and CloudTrail                                                   |Column, table, principal, encryption, and access controls                                |
|Stream processing           |Amazon Managed Service for Apache Flink or Lambda                                              |Sessionization, rolling aggregates, feature updates, and event normalization             |
|Canonical identity          |Amazon DynamoDB                                                                                |Low-latency merchant-SKU-to-product lookup with mapping versions                         |
|Lexical and vector retrieval|Amazon OpenSearch Service                                                                      |Hybrid product retrieval with metadata filtering                                         |
|Precomputed candidate lists |Amazon DynamoDB                                                                                |Collaborative, replenishment, affinity, and trending top-K lists                         |
|Hot cache                   |Amazon ElastiCache for Redis                                                                   |Recent-intent state and repeated candidate or metadata reads                             |
|Feature management          |SageMaker Feature Store or the approved enterprise feature platform                            |Training-serving parity where the extra platform is justified                            |
|Online coordinator          |Amazon ECS on Fargate behind an internal ALB; use existing EKS if it is the enterprise standard|Low-latency fan-out, merge, eligibility, and pruning                                     |
|Triggered orchestration     |EventBridge Pipes or Kinesis with Lambda or ECS                                                |Event filtering, enrichment, idempotency, and candidate generation                       |
|Batch orchestration         |Step Functions with EMR Serverless or AWS Glue                                                 |Large-cohort generation without synchronous online traffic                               |
|Model lifecycle             |SageMaker Processing, Training, Model Registry, Batch Transform, and endpoints                 |Reproducible training, approval, deployment, monitoring, and rollback                    |
|Configuration               |AWS AppConfig and versioned S3 artifacts                                                       |Arm activation, quotas, deadlines, rule versions, and emergency disable controls         |
|Telemetry                   |CloudWatch, AWS X-Ray, and OpenTelemetry                                                       |Metrics, traces, structured logs, alarms, and lineage                                    |

ECS on Fargate is the default here because the coordinator is a long-lived concurrent service. If Shopping already has a mature EKS platform with standard deployment, observability, and autoscaling, deploy the same container there rather than introducing a second runtime.

2.3 Account and network layout

• Use separate production, nonproduction, and data/ML accounts under the existing organization model.
• Keep the coordinator, model endpoints, DynamoDB, OpenSearch, and ElastiCache on private paths.
• Use VPC endpoints or PrivateLink where supported. Serving traffic should not require public internet egress.
• Run containers and endpoints across at least three Availability Zones where the Region supports it.
• Use distinct IAM roles for the coordinator, each indexing pipeline, batch jobs, model training, and surface consumers.
• Grant every retrieval arm only the data access it needs.
• Encrypt streams, buckets, tables, indexes, caches, features, and model artifacts with approved KMS keys and explicit key ownership.
• Apply separate scaling, quota, and budget boundaries to online, triggered, and batch workloads.

2.4 Online request path

Implement the coordinator as a stateless Java, Go, or equivalent service.

1. An internal load balancer receives an authenticated candidate request.
2. The coordinator validates the contract and loads versioned placement configuration from AppConfig or a local cache.
3. It resolves low-latency shopper context and starts the configured retrieval arms concurrently.
4. Each arm receives a quota and deadline and returns source identifiers, scores, reasons, and attributes.
5. The coordinator maps identifiers to canonical products and merges duplicate contributions.
6. It retrieves or verifies current offer state and enforces hard eligibility.
7. It applies quotas, a cheap coarse score, and diversity-aware pruning.
8. It returns candidates, provenance, freshness, versions, and partial-success metadata.
9. The surface ranker orders the set or returns no placement.
10. Catalog and creative services hydrate only selected items.

An illustrative p99 candidate-generation budget is:

|Stage                                |Budget    |
|-------------------------------------|---------:|
|Validation and configuration         |10 ms     |
|Context and lightweight features     |35 ms     |
|Retrieval arms in parallel           |100 ms    |
|Merge, deduplication, and eligibility|55 ms     |
|Coarse scoring and response          |50 ms     |
|Network and jitter reserve           |50 ms     |
|**Total**                            |**300 ms**|

These are design placeholders. Load tests must replace them with measured budgets. The coordinator must cancel outstanding work at the request deadline and return a partial result only when the minimum candidate floor is met.

2.5 Retrieval-arm interface

Each retrieval arm should implement the same internal interface:

```text
interface RetrievalArm {
  name
  supported_placements
  retrieve(context, constraints, quota, deadline)
    -> [(source_item_id, score, reason, attributes)]
}

ArmResultMetadata
  started_at
  completed_at
  timed_out
  fallback_used
  raw_count
  canonical_count
  eligible_count
  unique_count
```

Configure arm activation, quota, timeout, minimum score, and fallback per placement in AppConfig. Deploy new arms dark, record their output, and measure unique contribution before allowing them to affect returned candidates.

2.6 Retrieval and state stores

OpenSearch

Use OpenSearch for lexical and embedding similarity over canonical products. Store the canonical product identifier as the document identifier and index stable filterable metadata such as locale, category, brand, and coarse availability.

Do not treat OpenSearch as the authority for fast-changing price, inventory, promotion, or customer-specific eligibility. Benchmark Serverless and provisioned options with the actual corpus, filters, concurrency, latency, index-refresh requirement, and cost profile before choosing.

DynamoDB

Use DynamoDB for:

• Merchant-SKU-to-canonical-product mappings
• Precomputed collaborative or co-engagement lists
• Replenishment and affinity candidates
• Trending lists by locale and category
• Versioned rule and artifact references where appropriate
• Idempotency records for triggered and batch execution

Keep items bounded, use sort keys for score order where appropriate, add TTL to ephemeral lists, and record the generating job and data snapshot.

ElastiCache

Use Redis for hot repeated reads, recent-intent state, and short-lived metadata. It should accelerate an authoritative source, not become a second system of record.

2.7 Canonicalization, deduplication, and eligibility

The merge stage should:

1. Translate every source identifier to a canonical product identifier while retaining the source identifier for diagnosis.
2. Combine duplicate contributions and retain every retrieval source, score, and reason.
3. Apply per-arm and per-category quotas before one high-volume arm consumes the set.
4. Attach current eligible offers and discard products with no valid proposition unless the placement explicitly allows inspiration-only content.
5. Apply coarse scoring and diversity-aware pruning to the requested maximum.

Use deterministic tie-breaking based on stable identifiers so replay and A/B analysis are not polluted by incidental ordering. Preserve raw, canonical, eligible, and returned counts for every arm.

Eligibility should be a versioned decision function over candidate, shopper, placement, and effective time. Compile or cache stable policy artifacts, but resolve volatile offer state from a fresh source. Record an explicit drop reason for every rejected candidate.

2.8 Surface ranking and late hydration

Surface models may run on shared SageMaker endpoints or equivalent infrastructure, but each deployment must bind a specific surface and placement to its feature schema, objective, model artifact, calibration, and fallback.

The ranker may return no placement. After selection, fetch images, formatted price, badges, legal text, creative inputs, and deep links only for the final items. Recheck volatile eligibility immediately before delivery when the channel delay is material.

2.9 Triggered execution

Use EventBridge Pipes or Kinesis consumers to select events such as price changes, replenishment signals, and catalog changes. The triggered worker should:

1. Validate and enrich the event.
2. Create an idempotency key from event, shopper, placement, and rule version.
3. Invoke the candidate semantics with mode=TRIGGERED.
4. Invoke the surface ranker.
5. Apply channel contact policy outside the candidate platform.
6. Persist the decision and publish a delivery request only when policy permits.

Retries and a dead-letter path must not create duplicate sends. A newer event should supersede stale work where the use case requires it.

2.10 Batch execution

Do not loop over the synchronous online API for large campaigns. A Step Functions workflow should select versioned input snapshots, partition the cohort, run distributed retrieval and ranking with EMR Serverless or Glue, write candidate and decision outputs to S3, validate counts and eligibility, and publish a versioned manifest for downstream delivery.

Batch must reuse the same schemas, canonical mappings, rule definitions, feature definitions, reason codes, and evaluation libraries as online execution. It may use a separate implementation optimized for scans, joins, and vectorized inference.

Batch outputs should record campaign, shopper, candidate set, selected items, all artifact versions, generation and expiration times, and outcome-linkage keys. Reruns should write a new immutable version rather than silently overwrite an earlier decision.

2.11 Event lake and replay

Land raw and normalized shopper, catalog, offer, campaign, candidate, impression, and outcome events in S3. Use Iceberg tables and the Glue Data Catalog for schema evolution, snapshot queries, and as-of reconstruction. Partition for access patterns without over-partitioning by high-cardinality identifiers.

Maintain both event time and processing time. Preserve source offsets and deduplication keys. The replay harness should bind a request to exact catalog, identity, eligibility, feature, model, and experiment versions and should fail when required historical state is missing rather than use current data silently.

2.12 Feature and model lifecycle

Use one feature definition for offline and online computation wherever possible. Materialize slow-changing aggregates to S3 for training and batch and to an online store only when interactive latency requires it. Every feature must have an owner, entity key, event-time semantics, freshness expectation, null behavior, sensitivity classification, and deletion behavior.

Generate product embeddings offline with SageMaker Processing or the approved ML platform. Register the model and source snapshot, validate vector quality, and bulk-publish versioned embeddings to OpenSearch. Keep the previous version available for rollback.

A model pipeline should:

1. Build point-in-time-correct training data from lake snapshots.
2. Train and evaluate the coarse model or a surface model.
3. Register the artifact with feature, code, data, and objective metadata.
4. Require the appropriate technical, product, and model-risk approvals.
5. Deploy in shadow or canary mode.
6. Compare latency, quality, calibration, drift, and customer-cost metrics.
7. Promote or roll back through an immutable deployment configuration.

Independent experiment namespaces are required for retrieval arms, candidate policy, coarse pruning, and final surface ranking.

2.13 Failure behavior

|Failure                                |Required behavior                                                                                         |
|---------------------------------------|----------------------------------------------------------------------------------------------------------|
|One optional retrieval arm times out   |Return partial success if the minimum candidate floor is met; record the omitted arm.                     |
|Canonical mapping is missing           |Quarantine or use an explicitly approved source-level fallback; never collapse unrelated products.        |
|Volatile eligibility cannot be verified|Fail closed for the affected candidate.                                                                   |
|Feature is missing                     |Use a versioned default only when the model contract permits it; emit a metric.                           |
|Coarse model endpoint is unavailable   |Use a deterministic heuristic or last approved lightweight artifact.                                      |
|OpenSearch is impaired                 |Use bounded precomputed lists and cache fallback for eligible placements.                                 |
|Batch partition fails                  |Retry idempotently, isolate the partition, and publish no final manifest until completeness policy is met.|
|Feedback stream is delayed             |Continue serving but alarm on attribution lag and prevent affected data from silently entering training.  |

Multi-Region behavior should be chosen from business recovery requirements, not added by default. The first design should be Multi-AZ within one Region, with tested backup and restore for durable state and rebuild procedures for derived indexes.

2.14 Security and privacy controls

• Use tokenized internal shopper references in service contracts.
• Exclude direct identifiers and contact data from retrieval indexes and telemetry.
• Classify candidate, feature, and outcome fields and enforce purpose-based access.
• Use IAM roles for workloads; do not distribute static credentials.
• Encrypt data in transit with TLS and at rest with customer-approved KMS keys.
• Use Lake Formation and data-access policies for governed S3 data.
• Use OpenSearch network and data-access policies appropriate to the selected deployment model.
• Restrict production data access from nonproduction accounts.
• Log configuration, policy, model, and data-access changes to CloudTrail.
• Define deletion propagation for lake records, features, caches, indexes, and training datasets.
• Redact request payloads in logs; use identifiers and reason codes for diagnosis.

2.15 Observability and operations

Propagate request_id, candidate_set_id, shopper_ref, placement, mode, experiment assignments, artifact versions, and trace context through every stage. Do not log raw sensitive context.

Dashboards and alarms should cover:

• Traffic, latency, errors, saturation, and partial-success rate by placement and mode
• Per-arm latency, timeout rate, candidate count, unique contribution, and cost
• Identity miss rate and duplicate-collapse rate
• Eligibility drops by reason and invalid-item escape rate
• Index, feature, offer-state, and feedback lag
• Candidate-set size and no-placement rate
• Model latency, feature missingness, score distribution, drift, and calibration
• Batch completeness, retries, age, and completion-window risk
• Unit cost by placement, mode, arm, index, and inference endpoint

Use burn-rate alerts for SLOs. Page on customer-impacting conditions; ticket slow quality and cost regressions.

2.16 Capacity and cost model

Estimate capacity independently for online, triggered, and batch modes. Inputs should include peak request rate, cohort size, active placements, arms per placement, raw candidates per arm, returned N, feature reads, vector-query concurrency, offer-validation reads, inference count, event volume, retention, and replay frequency.

Cost controls should include:

• Per-placement arm quotas and deadlines
• Bulk reads and request coalescing for hot state
• Late presentation hydration
• Batch rather than synchronous execution for large cohorts
• Reserved or provisioned capacity only after measuring stable utilization
• Separate cost attribution for each arm and model endpoint
• Automatic detection of arms with high cost and negligible unique contribution

The architecture review should compare ECS and the existing EKS platform, OpenSearch Serverless and provisioned domains, and SageMaker Feature Store and the existing enterprise feature platform using measured workload data.

2.17 Delivery plan

Phase 0: Evidence and contract

• Select one Email placement and one Feed placement with overlapping inventory and usable outcome data.
• Define canonical identity coverage, placement semantics, eligibility rules, candidate budgets, and baseline winner labels.
• Implement point-in-time replay for recent intent, affinity, semantic, popular, and editorial arms.
• Produce recall, overlap, unique contribution, duplicate-collapse, freshness, and cost curves.
• Approve or reject the shared boundary based on the acceptance gates.

Phase 1: Shadow online slice

• Build the versioned API and outcome-event schemas.
• Deploy the coordinator with two or three retrieval arms.
• Implement canonicalization, hard eligibility, provenance, and deterministic replay.
• Shadow one Feed placement without changing customer output.
• Validate latency, partial success, operational load, and unit cost.

Phase 2: Production pilot

• Enable one Feed placement behind an experiment.
• Add one scheduled Email campaign using the batch path.
• Preserve independent surface ranking and policy.
• Run a holdout and monitor customer-value and customer-cost metrics.

Phase 3: Expansion

• Add triggered price and replenishment use cases.
• Add arms only when offline and shadow evidence shows incremental value.
• Improve identity coverage, feature reuse, and automated governance.
• Introduce multi-Region capabilities only if the approved recovery requirements justify them.

2.18 Decisions to close before detailed design

|Decision          |Question                                                                                               |
|------------------|-------------------------------------------------------------------------------------------------------|
|Product identity  |What share of active offer volume has a reliable canonical product, and who owns merge quality?        |
|Pilot placements  |Which Email and Feed placements share enough inventory and outcome data to test reuse?                 |
|Candidate budget  |What value of N gives acceptable recall and ranker cost by placement?                                  |
|Freshness classes |How old may intent, price, inventory, promotion, and suppression state be by mode?                     |
|Global eligibility|Which rules are invariant and which remain surface policy?                                             |
|Compute standard  |Is ECS/Fargate or the existing EKS platform the approved runtime?                                      |
|Search deployment |Does Serverless or provisioned OpenSearch best meet measured latency, refresh, control, and cost needs?|
|Feature platform  |Does the existing enterprise feature platform meet online/offline parity and governance needs?         |
|Model ownership   |Who approves, promotes, monitors, and rolls back the coarse model and each surface model?              |
|Batch window      |What are the cohort size, completion deadline, retry policy, and isolation requirements?               |
|Outcome truth     |Which events and attribution windows define success for Email, Feed, and Push?                         |
|Customer cost     |How do fatigue, unsubscribe, dismissal, and interruption cost enter experiments and ranking?           |
|Recovery posture  |What RPO, RTO, and regional behavior does each execution mode require?                                 |

References

• Uber Eats search pipeline
• Amazon OpenSearch Service vector search
• Amazon Kinesis Data Streams
• AWS Glue and Apache Iceberg
• AWS Step Functions Distributed Map
• Amazon SageMaker Feature Store
• Amazon SageMaker real-time inference
• Amazon SageMaker Batch Transform
• AWS Well-Architected Reliability Pillar

Validate service availability, quotas, security controls, and enterprise standards in the target AWS accounts and Regions during detailed design.