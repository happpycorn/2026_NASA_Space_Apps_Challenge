# FINAL ORBIT player guide

Two years ago, you authorized Astra Dynamics’ first orbital demonstration. The rocket lost contact after launch, and investors pulled out. A government commission gives the team another chance. You lead the missions. Alex manages the budget and schedule, Elena advises on engineering and tests, and Samuel brings commissions and partnership terms. See the [campaign outline](main-story.md) for the scene sequence.

## How each chapter works

1. Read the briefing. Find out who needs the result, what they need to receive, and when it is due.
2. Choose a plan. Compare the capability, time, and budget each component or partnership requires. Schedule fabrication and integration.
3. Decide what to verify. A test provides evidence about the design. A repair changes the hardware, and changes after design freeze may require another integration test.
4. Submit the flight readiness review (FRR). Check that the evidence applies to the configuration that will fly. Resolve any blocking items. If the review permits you to accept a remaining risk, your signature goes into the mission record.
5. Operate and deliver. See what actually happened in flight, how much data reached the ground, and whether it met the contract. A stopped launch, a delivery shortfall, a completed contract, and an extra delivery each have a debrief.

The workbench shows the current mission phase. Design, fabrication, integration, and review lead into operations and closeout. Labels A–F map the game’s work to NASA’s project life cycle. [NASA NPR 7120.5F, Chapter 2](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7120_005F_&page_name=Chapter2)

## The three commissions

### First Light · CubeSat

The flood access map needs two usable sets of visible-light images. The bay discharge survey needs three usable temperature strips. Both are due by the end of first contact. After selecting a commission, compare mass limits, handover dates, and downlink slots for the two launch options. An auxiliary sensor can recover data when some observations are obstructed, but the extra interface needs integration. Test early, or repair or remove the sensor and retest if integration fails. The ground station receives health telemetry first. A follow-up target needs both spare downlink capacity and an available observation.

A **day-in-the-life test (DITL)** runs the flight sequence on the ground. The game checks separation, deployment, and first-transmission times against this flight’s interface requirements. [NASA CubeSat 101, §6.9.1](https://science.nasa.gov/wp-content/uploads/2023/06/nasa_csli_cubesat_101_508.pdf#page=67)

### Second Attempt · Orbital demonstration

Choose a 400 km interface demonstration or a 550 km sun-synchronous orbit with a tighter lift limit and a sponsor premium. Deliver a 70 kg test payload to the contracted orbit and downlink enough confirmation data. When the sponsor cuts the second payment, compare the remaining funds with the work still on the plan. Analysis and hot-fire tests refine what you know about lift margin. Ground station tests give you evidence about whether first contact can carry the required data.

If you find a ground data link fault, Elena reflects on the old loss of contact. Review and debrief lines follow the actual tests and signatures on this flight. The first accident remains unresolved.

### Lunar Contract · Surface science

Choose funding, technical support, or an independent plan, then work through payload, landing backup, power, and transfer options. Partners make offers according to the mission’s events and contract status. The government may move a deadline or offer to pay for a second payload. Added hardware uses mass allowance and can add integration work. In the seven flight stages, deal with whatever happens using the resources you brought. The basic contract calls for arrival on the Moon and usable surface science data.

## Read the results

Identify the plan you chose, what the tests showed, and what made it to the ground. If integration failed to decode frames from your auxiliary sensor, the report keeps that finding. If you chose to remove the sensor and passed a retest, the flight uses the final approved configuration. Some tests narrow uncertainty. Evidence applies to the configuration you verified. [NASA Systems Engineering Handbook, §5.3](https://www.nasa.gov/reference/5-3-product-verification/)

Open the mission portfolio from the lobby or lunar results to see your best recorded result for each chapter and the partnership benefits you earned across attempts. On the CubeSat results screen, **Replay this commission** starts a new scenario for the same client, and **Choose another commission** returns to the commission list. In the orbital and lunar chapters, **Play again?** starts a new scenario for the same mission.

## Glossary

| Term | Meaning in play |
| --- | --- |
| Payload | Equipment that produces data or performs an experiment, such as a camera or a spectrometer. |
| Margin | Capacity remaining inside a limit, such as how much more mass a launcher can carry. |
| Contact and downlink | A contact is when the ground station can talk to the spacecraft. A downlink sends data to the ground. |
| Design freeze | The configuration enters fabrication. Later changes cost time and may require retesting. |
| Residual risk | A problem that could still occur after review. Use the available evidence and the consequences to decide whether to study, fix, or accept it. [NASA technical risk management](https://www.nasa.gov/reference/6-4-technical-risk-management/) |
| Seed | A value that lets you reproduce a run’s events and risk conditions. |

Schedules, thresholds, and costs in the guide are game settings. AI assisted with bilingual copy, code, and tests.
