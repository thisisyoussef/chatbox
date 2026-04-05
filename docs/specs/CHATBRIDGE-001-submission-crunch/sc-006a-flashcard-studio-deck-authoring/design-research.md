# SC-006A Design Research

## Repo Evidence

- `src/renderer/components/chatbridge/apps/ReviewedAppLaunchSurface.tsx`
  proves Flashcard Studio should reuse the reviewed launch shell instead of
  inventing another host surface.
- `src/renderer/packages/chatbridge/bridge/reviewed-app-runtime.ts`
  already contains a rich stateful runtime pattern in Drawing Kit, including
  bootstrap, sync, checkpoint, and completion events.
- `src/renderer/components/chatbridge/apps/story-builder/StoryBuilderPanel.tsx`
  shows the calmer information-card treatment used for bounded state summaries,
  but it is not an editable runtime.

## Interaction Findings

- The Flashcard authoring surface needs explicit card ordering controls because
  drag-and-drop is not otherwise established in the reviewed runtime.
- The empty state must occupy real space in the layout so the user understands
  where cards will appear after creation.
- The current reviewed launch surface already handles iframe sizing and
  persistence; Flashcard Studio only needs a sensible minimum height.

## Design Implications

- A split index-card studio is a better fit than a table or wizard because it
  keeps order, selection, and editing visible at once.
- Card labels should be derived from prompts, not answers, so later-turn
  continuity stays compact.
- The runtime should emit status text tied to the latest action, for example
  “Card moved up” or “Card deleted”.

## External Research

- None required for this slice. The repo already contains the reviewed-runtime
  interaction model and enough visual language to defend the direction.
