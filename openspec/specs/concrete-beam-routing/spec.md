# Concrete Beam Routing Specification

## Purpose

Routing wiring for the existing Viga de Hormigón Armado calculator. Makes ConcreteForm and ConcreteResults reachable via `/concrete` and `/concrete-results` routes.

## Requirements

### Requirement: Concrete Beam Routing
The system MUST render ConcreteForm at `/concrete` and ConcreteResults at `/concrete-results`. NavBar MUST show a "Viga H°" link to `/concrete`.

- GIVEN the user navigates to `/concrete` WHEN the app loads THEN ConcreteForm renders
- GIVEN ConcreteForm is submitted with valid input WHEN results are computed THEN the app navigates to `/concrete-results` with concrete beam state
- GIVEN the user is on `/concrete-results` WHEN clicking "Volver" THEN the app navigates to `/concrete`
