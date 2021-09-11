
class ChoosyBuilder extends Application{

	constructor(){
		super();
		this.currentChoices = []
	}

	static get defaultOptions()
	{
		const options = super.defaultOptions;
		options.id = "choosy-builder";
		options.template = "modules/choosy/templates/blankForm.html"
		options.resizable = true;
		options.height = "auto";
		options.width = 400;
		options.minimizable = true;
		options.title = "Choosy"
		return options;
	}

	static makeUuid(data){
		if ("pack" in data){
			//is from compendium
			return `Compendium.${data["pack"]}.${data["id"]}`;
		}

		//it is an item from the world
		return `Item.${data.id}`;
	}

	async getItem(data){
		if (data["type"] != "Item"){
			console.warn(`can't add ${data} because it is not an Item`);
			return;
		}

		let uuid = ChoosyBuilder.makeUuid(data);
		return fromUuid(uuid);
	}

	makeData(item){
		return {
			name: item.data.name,
			img: item.data.img,
			uuid: item.uuid
		};
	}

	activateListeners(html) {
		super.activateListeners(html)

		if (!this.targetItem){
			//drop item in target
			html.find(".target-box").on("drop", null, this._newTargetItem.bind(this));

			return;
		}

		//control buttons for target item
		html.find(".remove-target").on("click", null, this._clearTargetItem.bind(this));
		html.find(".target-item-edit").on("click", null, this._editTargetItem.bind(this));


		//overall choice handlers
		html.find(".create-new-choice").on("click", null, this._addNewChoice.bind(this));

		//single choice handlers
		html.find(".remove-choice").on("click", null, this._removeChoice.bind(this))
		html.find(".choice-name-input").on("input", null, this._changeChoiceName.bind(this))
		html.find(".new-choice-box").on("drop", null, this._newChoiceBox.bind(this));

		//edit choices items
		html.find(".choice-item-edit").on("click", null, this._choosyItemEdit.bind(this));
		html.find(".remove-choice-item").on("click", null, this._removeChoiceItem.bind(this));

		//new choice and item box handler

		html.find(".new-choice-and-item-box").on("drop", null, this._makeChoiceAndItem.bind(this))
		html.find(".make-choosy-item").on("click", null, this._makeChoosyItem.bind(this))
	}

	async _newTargetItem(ev){
		let data = JSON.parse(ev.originalEvent.dataTransfer.getData("Text"));

		let item = await this.getItem(data);

		if (!item){
			ui.notifications.error("Dropped item not found!");
			return;
		}

		this.targetItem = this.makeData(item);

		let oldChoices = item.data.flags.choosy?.choices;

		if (oldChoices){
			this.currentChoices = await Promise.all(
				oldChoices.map(async (choice)=>{
					let ch = new Choice(this);

					ch.name = choice.name;
					ch.items = await Promise.all(choice.given.map(itemUuid=>{
							return fromUuid(itemUuid).
								then(res => {
									if (res){
										return this.makeData(res)
									}
								});
						}));

					return ch
				})
			);

			console.log(this.currentChoices);
		}

		this.render();
	}

	_clearTargetItem(ev){
		this.targetItem = undefined;
		this.currentChoices = [];

		this.render();
	}

	async _editTargetItem(ev){
		let item = await fromUuid(this.targetItem.uuid);

		if (!item){
			ui.notifications.error("Target item not found!");
			return;
		}

		item.sheet.render(true);
	}

	async _addNewChoice(ev){
		this.currentChoices.push(new Choice(this));

		this.render();
	}

	async _removeChoice(ev){
		let listItem = ev.target.closest(".choosy-choice-set")
		this.currentChoices.splice(parseInt(listItem.dataset.index), 1);

		this.render();
	}

	async _changeChoiceName(ev){
		let listItem = ev.target.closest(".choosy-choice-set")
		let a = this.currentChoices[parseInt(listItem.dataset.index)]

		a.name = ev.target.value;
	}

	async _newChoiceBox(ev){
		let data = JSON.parse(ev.originalEvent.dataTransfer.getData("Text"));
		let item = await this.getItem(data);

		if (!item){
			ui.notifications.error("Failed to get item from drop event");
			return;
		}

		let itemData = this.makeData(item);

		let listItem = ev.target.closest(".choosy-choice-set")
		let choice = this.currentChoices[parseInt(listItem.dataset.index)]

		choice.pushNewItem(await itemData);

		this.render();
	}

	async _choosyItemEdit(ev){
		let choiceIndex = parseInt(ev.target.closest(".choosy-choice-set").dataset.index)
		let itemIndex = parseInt(ev.target.closest(".choice-item-line").dataset.index)

		let item = await fromUuid(this.currentChoices[choiceIndex].items[itemIndex].uuid);

		if (!item){
			ui.notifications.error("Item in choice no longer exists! You probably want to remove it");
			return;
		}

		item.sheet.render(true);
	}

	async _removeChoiceItem(ev){
		let choiceIndex = parseInt(ev.target.closest(".choosy-choice-set").dataset.index)
		let itemIndex = parseInt(ev.target.closest(".choice-item-line").dataset.index)

		this.currentChoices[choiceIndex].items.splice(itemIndex, 1);
		this.render(true);
	}

	async _makeChoiceAndItem(ev){
		let data = JSON.parse(ev.originalEvent.dataTransfer.getData("Text"));
		let item = await this.getItem(data);

		if (!item){
			ui.notifications.error("Failed to get item from drop event");
			return;
		}

		let itemData = this.makeData(item);

		this.currentChoices.push(new Choice(this));
		this.currentChoices[this.currentChoices.length - 1].pushNewItem(itemData);

		this.render(true);
	}

	async _makeChoosyItem(ev){
		let itemData = await fromUuid(this.targetItem.uuid)

		let merged = mergeObject(itemData.toObject(),
			{'flags.choosy': {
				choices: this.currentChoices.map(c => c.toObject())
			}})
		let item = await Item.create(merged)
	}

	getClosestChoiceToEvent(ev){
		this.currentChoices[parseInt(ev.target.closest(".choosy-choice-set").dataset.index)]
	}

	getEmptyDiv(){
		return `<div class="target-box choosy-builder-qualifier empty-box">Drop item here to start</div>`
	}

	getTargetedDiv(){
		return `
		<h2>Currently working off of:</h2>
		<div class="target-item flexrow choosy-builder-qualifier item">
			<div class="choosy-builder-qualifier item-image" style="background-image: url('${this.targetItem.img}')"></div>
			<div>${this.targetItem.name}</div>
			<div class="choosy-builder-qualifier item-controls flexrow">
			<a class="target-item-edit" ><i class="fas fa-edit"></i></a>
			<a class="remove-target" ><i class="fas fa-times"></i></a>
			</div>
		</div>`
	}

	getChoicesDiv(){
		return `<div>
			<div class="flexrow"><h2>Choices</h2><a class="create-new-choice">+ Add</a></div>
			<ol>
				${this.currentChoices.reduce((acc, val, index)=>{
					return acc + val.getListItem(index);
				}, "")}
			</ol>
			<div class="new-choice-and-item-box choosy-builder-qualifier empty-box">Make a new choice with an item</div>
		</div>`
	}

	getMakeItButton(){
		return `<h1 class="make-choosy-item">Make It</h1>`
	}

	async getData(){
		const sheetData = super.getData();

		if (this.targetItem){
			sheetData.div = this.getTargetedDiv() + this.getChoicesDiv() + this.getMakeItButton();
		}
		else{
			sheetData.div = this.getEmptyDiv();
		}

		return sheetData;
	}
}

class Choice{
	constructor(parent){
		this.name = ""
		this.items = []
		this.parent = parent
	}

	pushNewItem(item){
		this.items.push(item);

		//test for automatically naming the choice
		if (this.items.length == 1 && this.name == ""){
			let match = item.name.match(new RegExp(`${this.parent.targetItem.name}: (.+)`));

			if (match){
				this.name = match[1]
			}
		}
	}

	static getItemDisplay(item){
		if (item){
			return Choice.getFilledItemDisplay(item);
		}
		else{
			return Choice.getEmptyItemDisplay(item);
		}
	}

	static getFilledItemDisplay(item){
		return `<div class="flexrow choosy-builder-qualifier item">
			<div class="choosy-builder-qualifier item-image" style="background-image: url('${item.img}')"></div>
			<div>${item.name}</div>
			<div class="choosy-builder-qualifier item-controls flexrow">
			<a class="choice-item-edit" ><i class="fas fa-edit"></i></a>
			<a class="remove-choice-item" ><i class="fas fa-times"></i></a>
			</div>
		</div>`
	}

	static getEmptyItemDisplay(item){
		return `<div class="flexrow choosy-builder-qualifier item">
			<div>Missing Item, Delete Me</div>
			<div class="choosy-builder-qualifier item-controls flexrow">
			<a class="remove-choice-item" ><i class="fas fa-times"></i></a>
			</div>
		</div>`
	}

	getListItem(index){
		return `<li class="choosy-choice-set" data-index="${index}">
		<div class="flexrow choosy-builder-qualifier item">
			<div>Choice: </div>
			<input class="choice-name-input" type="string" value="${this.name}">
			<div class="choosy-builder-qualifier item-controls flexrow">
			<a class="remove-choice" ><i class="fas fa-trash"></i></a>
			</div>
		</div>
		<ol>
		${this.items.reduce((acc, item, index) => {
			return acc + `<li class="choice-item-line" data-index="${index}">
				${Choice.getItemDisplay(item)}
			</li>`
		}, "")}
		</ol>
		<div class="new-choice-box choosy-builder-qualifier empty-box">Add item to this choice</div>
		</li>`
	}

	toObject(){
		let usableName = this.name;

		if (usableName == ""){
			if(this.items.length > 0){
				ui.notifications.info("Choice has no name, using first item's name");
				usableName = this.items[0].name;
			}
			else{
				ui.notifications.warn("Choice has no name, and no items, choice will look funny");
			}
		}

		return {
			name: usableName,
			given: this.items.map(val => val.uuid)
		}
	}
}

export default ChoosyBuilder;