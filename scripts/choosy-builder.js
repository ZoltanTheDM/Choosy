


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
		options.resizable = false;
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
		return await fromUuid(uuid);
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
			html.find(".target-box").on("drop", null, async function(ev){
				let data = JSON.parse(ev.originalEvent.dataTransfer.getData("Text"));

				let item = await this.getItem(data);
				this.targetItem = this.makeData(item);

				let oldChoices = item.data.flags.choosy?.choices;

				if (oldChoices){
					this.currentChoices = await Promise.all(
						oldChoices.map(async (choice)=>{
							let ch = new Choice(this);

							ch.name = choice.name;
							ch.items = await Promise.all(choice.given.map(itemUuid=>{
									return fromUuid(itemUuid).
										then(res => this.makeData(res));
								}));

							return ch
						})
					);
				}

				this.render();
			}.bind(this));

			return;
		}

		//control buttons for target item
		html.find(".remove-target").on("click", null, function(ev){
			this.targetItem = undefined;
			this.currentChoices = [];

			this.render();
		}.bind(this));

		html.find(".target-item-edit").on("click", null, async function(ev){
			(await fromUuid(this.targetItem.uuid)).sheet.render(true);
		}.bind(this));


		//overall choice handlers
		html.find(".create-new-choice").on("click", null, async function(ev){
			this.currentChoices.push(new Choice(this));

			this.render();
		}.bind(this));

		//single choice handlers
		html.find(".remove-choice").on("click", null, async function(ev){
			let listItem = ev.target.closest(".choosy-choice-set")
			this.currentChoices.splice(parseInt(listItem.dataset.index), 1);

			this.render();
		}.bind(this))

		html.find(".choice-name-input").on("input", null, async function(ev){
			let listItem = ev.target.closest(".choosy-choice-set")
			let a = this.currentChoices[parseInt(listItem.dataset.index)]

			a.name = ev.target.value;
		}.bind(this))

		html.find(".new-choice-box").on("drop", null, async function(ev){
			let data = JSON.parse(ev.originalEvent.dataTransfer.getData("Text"));
			let itemData = this.makeData(await this.getItem(data));

			let listItem = ev.target.closest(".choosy-choice-set")
			let choice = this.currentChoices[parseInt(listItem.dataset.index)]

			choice.pushNewItem(await itemData);

			this.render();
		}.bind(this));

		//edit choices items
		html.find(".choice-item-edit").on("click", null, async function(ev){
			let choiceIndex = parseInt(ev.target.closest(".choosy-choice-set").dataset.index)
			let itemIndex = parseInt(ev.target.closest(".choice-item-line").dataset.index)

			let item = await fromUuid(this.currentChoices[choiceIndex].items[itemIndex].uuid);
			item.sheet.render(true);
		}.bind(this));

		html.find(".remove-choice-item").on("click", null, async function(ev){
			let choiceIndex = parseInt(ev.target.closest(".choosy-choice-set").dataset.index)
			let itemIndex = parseInt(ev.target.closest(".choice-item-line").dataset.index)

			this.currentChoices[choiceIndex].items.splice(itemIndex, 1);
			this.render(true)
		}.bind(this));

		//new choice and item box handler

		html.find(".new-choice-and-item-box").on("drop", null, async function(ev){
			let data = JSON.parse(ev.originalEvent.dataTransfer.getData("Text"));
			let itemData = this.makeData(await this.getItem(data));

			this.currentChoices.push(new Choice(this));
			this.currentChoices[this.currentChoices.length - 1].pushNewItem(await itemData);

			this.render(true);
		}.bind(this))

		html.find(".make-choosy-item").on("click", null, async function(ev){
			let itemData = await fromUuid(this.targetItem.uuid)

			let merged = mergeObject(itemData.toObject(),
				{'flags.choosy': {
					choices: this.currentChoices.map(c => c.toObject())
				}, name: "test"})
			let item = await Item.create(merged)
			console.log(item)
		}.bind(this))

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
			<a class="remove-target" ><i class="fas fa-trash"></i></a>
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
		return `<h1 class="make-choosy-item" id="a-uniquq-id" >Make It</h1>`
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

	getListItem(index){
		return `<li class="choosy-choice-set" data-index="${index}">
		<h3>Choice: <input class="choice-name-input" type="string" value="${this.name}"><a class="remove-choice" ><i class="fas fa-trash"></i></a></h3>
		<ol>
		${this.items.reduce((acc, val, index) => {
			return acc + `<li class="choice-item-line" data-index="${index}">
				<div class="flexrow choosy-builder-qualifier item">
					<div class="choosy-builder-qualifier item-image" style="background-image: url('${val.img}')"></div>
					<div>${val.name}</div>
					<div class="choosy-builder-qualifier item-controls flexrow">
					<a class="choice-item-edit" ><i class="fas fa-edit"></i></a>
					<a class="remove-choice-item" ><i class="fas fa-trash"></i></a>
					</div>
				</div>
			</li>`
		}, "")}
		</ol>
		<div class="new-choice-box choosy-builder-qualifier empty-box">Add item to this choice</div>
		</li>`
	}

	toObject(){
		return {
			name: this.name,
			given: this.items.map(val => val.uuid)
		}
	}
}

export default ChoosyBuilder;