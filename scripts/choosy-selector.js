
const CHOOSY_SCOPE = "choosy";
const CHOICE_KEY = "choice_made";
//game.user.character.unsetFlag("choosy", "choice_made")

class ChoosySelector extends Application{
	static HandleNewItem(item){
		if (item.parent && item.data.flags.choosy){
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
		options.id = `choosy-selector`;
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

		this.actor.createEmbeddedDocuments("Item",
			await Promise.all(item.data.flags.choosy.choices[choiceIndex].given.map((val)=>{
				return fromUuid(val).then(res => res.toObject());
			}))
		);

		// let choiceMadeFlags = this.actor.data.flags?.choosy?.choice_made ?? {}
		let choiceMadeFlags = this.actor.getFlag(CHOOSY_SCOPE, CHOICE_KEY) ?? {}

		choiceMadeFlags[item.id] = {choice: choiceIndex};

		await this.actor.setFlag(CHOOSY_SCOPE, CHOICE_KEY, choiceMadeFlags);

		this.checkForRender();
	}

	async getChoosyItems(){
		let choiceMadeFlags = await this.actor.getFlag(CHOOSY_SCOPE, CHOICE_KEY) ?? {};

		return this.actor.items.filter(item => item.data.flags.choosy && !(item.id in choiceMadeFlags));
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
								<a class="choice-selector-choose" data-index="${index}">${choice.name}</a>
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