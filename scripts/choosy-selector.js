
const CHOOSY_SCOPE = "choosy";
const CHOICE_KEY = "choice_made";
//game.user.character.unsetFlag("choosy", "choice_made")

class ChoosySelector extends Application{
	static HandleNewItem(item){
		if (item.parent && item.data.flags.choosy?.choices.length > 0){
			new ChoosySelector(item.parent).render(true)
		}
	}

	static HandleDeleteItem(item){
		if (item.parent && item.data.flags.choosy){
			ChoosySelector.removeOldFlags(item.parent)
		}
	}

	constructor(actor){
		super();
		this.actor = actor
	}

	static get defaultOptions()
	{
		const options = super.defaultOptions;
		options.template = "modules/choosy/templates/blankForm.html"
		options.resizable = true;
		options.height = "auto";
		options.width = 400;
		options.minimizable = true;
		options.title = "Choice Maker"
		return options;
	}


	activateListeners(html) {
		super.activateListeners(html)

		html.find('.choice-selector-choose').on("click", null, this._makeChoice.bind(this));
	}

	async _makeChoice(ev){
		let choiceIndex = parseInt(ev.target.closest(".choice-selector-choose").dataset.index);
		let itemUuid = ev.target.closest(".choice-selector-item").dataset.uuid;

		let item = await fromUuid(itemUuid)

		if (!item){
			ui.notifications.error("Could not find the item with that choice. Was it deleted?");
			this.checkForRender();
			return;
		}

		let given = item.data.flags.choosy.choices[choiceIndex].given

		// Give all items
		let givenItems = await Promise.all(given.filter(val => val.type == "Item").map((val)=>{
			return fromUuid(val.uuid).then(res => {
				if (res){
					return res.toObject();
				}
				else{
					ui.notifications.warn("Choice had an item that no longer exists");
				}
			});
		}))

		await this.actor.createEmbeddedDocuments("Item", givenItems.filter(f => !!f));

		// Execute macros

		given.forEach((val)=>{
			if (val.type != "Macro"){
				return;
			}

			fromUuid(val.uuid).then(macro => {
				if (macro){
					this._executeMacro(macro, val.args, item)
				}
			});
		})

		// Say item has had it's choice made

		let choiceMadeFlags = this.actor.getFlag(CHOOSY_SCOPE, CHOICE_KEY) ?? {}

		choiceMadeFlags[item.id] = {choice: choiceIndex};

		await this.actor.setFlag(CHOOSY_SCOPE, CHOICE_KEY, choiceMadeFlags);

		this.checkForRender();
	}

	//using advanced macros
	_executeMacro(sourceMacro, argsStr, item){
		let matches = argsStr.matchAll(/(("(?<st1>[^"]*)")|(?<st2>\S+))/g)

		try{
			sourceMacro.execute({actor: this.actor, item},
				...([...matches].map(match => match.groups.st1 || match.groups.st2 || "")))
		catch(e){
			let err = `Got an error in the script "${sourceMacro.name}": ${e}`;
			console.error(err);
			ui.notifications.error(err);
		}
	}

	//Old School
	//sans advanced macros
	// _executeMacroOld(sourceMacro, argsStr){

	// 	let macroCommand = sourceMacro.data.command;

	// 	let matches = argsStr.matchAll(/(("(?<st1>[^"]*)")|(?<st2>\S+))/g)

	// 	let args = "[" + [...matches].map(match => `"${match.groups.st1 || match.groups.st2 || ""}"`) + "]"

	// 	Macro.create({
	// 			name: "ChoosyScript",
	// 			type: "script",
	// 			img: null,
	// 			command: `let args = ${args};` + macroCommand
	// 		}, { displaySheet: false, temporary: true }).
	// 		then(mac => {
	// 			try{
	// 				mac.execute({actor: this.actor})
	// 			}
	// 			catch(e){
	// 				let err = `Got an error in the run script: ${e}`;
	// 				console.error(err);
	// 				ui.notifications.error(err);
	// 			}

	// 		})
	// }


	async getChoosyItems(){
		let choiceMadeFlags = await this.actor.getFlag(CHOOSY_SCOPE, CHOICE_KEY) ?? {};

		return this.actor.items.filter(item => (item.data.flags.choosy?.choices.length > 0) && !(item.id in choiceMadeFlags));
	}

	async checkForRender(){
		if (await this.stillMoreChoices()){
			this.render();
		}
		else{
			this.close();
		}
	}

	async stillMoreChoices(){
		return this.getChoosyItems().then(res => res.length > 0);
	}

	static async removeOldFlags(actor){
		let allChoices = actor.getFlag(CHOOSY_SCOPE, CHOICE_KEY) ?? {};

		const itemList = actor.items.contents.map(it => it.id);

		for (let choice in allChoices){
			if(!(itemList.includes(choice))){
				delete allChoices[choice];
			}
		}

		//Why do I have to unset before setting?
		await actor.unsetFlag(CHOOSY_SCOPE, CHOICE_KEY);
		await actor.setFlag(CHOOSY_SCOPE, CHOICE_KEY, allChoices);
	}

	async getChoiceDiv(choosies){
		return `
		<ol>
			${await this.getChoosyItems().then(res =>
				res.reduce((listItems, item)=>{
					return listItems + `<li class="choice-selector-item" data-uuid="${item.uuid}">
					<p>For item ${item.name} make choice of:</p>
					<div class="flexrow">${
						item.data.flags.choosy.choices.reduce((choiceButtons, choice, index)=>{
							return choiceButtons + `
								<a class="choice-selector-choose choosy-selector-qualifier choice-button" data-index="${index}">
								${choice.name}
								</a>
							`;
						}, "")
					}</div>
					</li>`
				}, "")
			)}
		</ol>
		`
	}

	async getData(){
		const sheetData = super.getData();

		if (await this.stillMoreChoices()){
			sheetData.div = await this.getChoiceDiv();
		}
		else{
			sheetData.div = "No choices to make. Close the window"
		}

		return sheetData;
	}
}

export default ChoosySelector;
