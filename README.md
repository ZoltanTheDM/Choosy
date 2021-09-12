# Choosy

This moudle is for use with Foundry VTT. This adds choices to items which will be asked when the item is added to a character's inventory.

There are 2 parts to this module

## Choosy Builder

The Builder is for creating an item's choices. A new button in the items directory tab that opens a dialog.

Drag the item you want to add a choice to into the box.
Then drag items to be gained or macro to be run when a choice is made. There can be any number of items gained and macros run per choice.

Export the item with pushing the button. (TODO do this with a drag)
This will create a *new* item with Choosy flags.

## Choosy Selector

When a choosy item is added to an actor a dialog will pop up for all unchosen items. Click on the choice and the new items will be added to the actor's inventory

The window will close when all choices are completed

# TODO

* Drag item out of Builder
* Multiple layers of choices, with out need for extra items
* Pick again (remove old items?)
* Imporved css
* View what items are gained with each choice
* Extra options and decriptions for the choices
* Button or selection style option
