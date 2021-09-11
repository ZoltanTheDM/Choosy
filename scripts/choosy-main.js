import ChoosyBuilder from "./choosy-builder.js"
import ChoosySelector from "./choosy-selector.js"

// Set up the user interface
Hooks.on("renderSidebarTab", async (app, html) => {
	if (app.options.id == "items") {
		let button = $("<button class='choosy-build'>Open Choosy</button>")

		button.click(function () {
			new ChoosyBuilder().render(true);
		});

		html.find(".directory-header").append(button);
	}
})

Hooks.on('createItem',(item,sheet,dragSource,user)=>{
	ChoosySelector.HandleNewItem(item);
})

Hooks.on('deleteItem',(item,sheet,dragSource,user)=>{
	ChoosySelector.HandleDeleteItem(item);
})
