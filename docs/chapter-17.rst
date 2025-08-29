============================
utils.js
============================

utils.js is a useful collection of javascript which comes with the scaffold app.

It contains a collection of utility functions that can be used for:
- String formatting
- DOM helpers
- AJAX requests
- Cookie handling
- Vue component registration
- File upload handling
- Internationalization (clientside T object)
- Debouncing and throttling functions
- Password strength calculation
- Tags inputs
- Form handling
- poor-mans htmx with <ajax-component>
- Flash message handling

string.format
~~~~~~~~~~~~~

It extends the String object prototype to allow expressions like this:

.. code:: javascript

    var a = "hello {name}".format(name="Max");

The Q object
~~~~~~~~~~~~

The Q object can be used like a selector supporting jQuery like syntax:

.. code:: javascript

   var element = Q("#element-id")[0];
   var selected_elements = Q(".element-class");

It supports the same syntax as JS ``querySelectorAll``
and always returns an array of selected elements (can be empty).

The Q objects is also a container for functions that can be useful when programming in Javascript.
It is stateless.

For example:

**Q.clone**

A function to clone any object:

.. code:: javascript

   var b = {any: "object"}
   var a = Q.clone(b);

**Q.eval**

It evaluates JS expressions in a string. It is not a sandbox.

.. code:: javascript

   var a = Q.eval("2+3+Math.random()");

**Q.ajax**

A wrapper for the JS fetch method which provides a nicer syntax:

.. code:: javascript

    var data = {};
    var headers = {'custom-header-name': 'value'}
    var success = response => { console.log("recereived", response); } 
    var failure = response => { console.log("recereived", response); }
    Q.ajax("POST", url, data, headers).then(success, failure);

**Q.get_cookie**

Extracts a cookie by name from the header of cookies in the current page:
returns null if the cookie does not exist. Can be used within the JS of a page to retrieve a session cookie
in case it is needed to call an API.

.. code:: javascript

   var a = Q.get_cookie("session");

**Q.register_vue_component**

This is specific for Vue 2 and may be deprecated in the future but it allows
to define a vue component where the template is stored in a separate HTML file
and the template will be loaded lazily only when/if the component is used.

For example instead of doing:

.. code:: javascript

    Vue.component('button-counter', {
    data: function () {
        return {
            count: 0
        }
    },
    template: '<button v-on:click="count++">You clicked me {{ count }} times.</button>'
    });

You would put the template in a button-counter.html and do

.. code:: javascript

    Q.register_vue_component("button-counter", "button-counter.html", function(res) {
        return {
            data: function () {
                return {
                    count: 0
                };
            };
    });


**Q.upload_helper**

It allows to bind an input tag of type file to a callback so that when a file is selected
the content of the selected file is loaded, base64 encoded, and passed to the callback.

This is useful to create form which include an input field selector - but you want to
place the content of the selected file into a variable, for example to do an ajax post of that content.

For example:

.. code:: html

   <input type="file" id="my-id" />

and 

.. code:: javascript

   var file_name = ""
   var file_content = "";
   Q.upload_helper("my_id", function(name, content) {
      file_name = name;
      file_content = content; // base 64 encoded;
   }


**Q.debounce**

Primitive debounce function wrapper. Delays execution by the given delay,
which ensures the last call always happens. 

.. code:: javascript

   setInterval(50, Q.debounce(function(){console.log("hello!")}, 200));

In the example, the function is called every 100ms but debounced to 200ms. The actual function
is called 200ms after the original call, ignoring subsequent ones.


**Q.throttle**

Throttle a function. Similar to Q.debounce, with 2 advantages:
- The first call goes through immediately
- The latest call is stored, and if no more calls come in, is executed after the delay

This is ideal for event handlers, to ensure the latest event is handled eventually.

.. code:: javascript

   Q("#my-input").addEventListener("change", Q.throttle((e) => {
            console.log(`changed to: ${event.target.value}`);
        }, 500)
    );

A user writing in a text field with id ``#my-input`` would normally cause change events
for every character. But with throttle, it will log out the first character, and then
every 500ms until the user is done typing. The last event with the final state will be
logged at most 499ms after the user stops typing.


**Q.tags_inputs**

It turns a regular text input containing a string of comma separated tags into a tag widgets.
For example:

.. code:: html

    <input name="browsers"/>

and in JSL

.. code:: javascript

   Q.tags_input('[name=zip_codes]')

You can restrict the set of options with:

.. code:: javascript

   Q.tags_input('[name=zip_codes]', {
      freetext: false,
      tags: ['Chrome', 'Firefox', 'Safari', 'Edge']
   });

It works with the datalist element to provide autocomplete. Simply prepend `-list` to the datalist id:

.. code:: html

    <input name="browsers"/>
    <datalist id="browses-list">
       <option>Chrome</option>
       <option>Firfox</option>
       <option>Safari</option>
       <option>Edge</option>
    </datalist>

and in JS:

.. code:: javascript

   Q.tags_input('[name=zip_codes]', {freetext: false});

It provides more undocumented options.
You need to style the tags. For example:

.. code:: css

    ul.tags-list {
      padding-left: 0;
    }
    ul.tags-list li {
      display: inline-block;
      border-radius: 100px;
      background-color: #111111;
      color: white;
      padding: 0.3em 0.8em 0.2em 0.8em;
      line-height: 1.2em;
      margin: 2px;
      cursor: pointer;
      text-transform: capitalize;
    }
    ul.tags-list li[data-selected=true] {
      opacity: 1.0;
    }

Notice that if an input element has class ``.type-list-string`` or ``.type-list-integer``, utils.js applies the
```tag_input`` function automatically.

**Q.score_input**

.. code:: javascript

    Q.score_input(Q('input[type=password]')[0]);

This will turn the password input into a widget that scores the password complexity.
It is applied automatically to inputs with name "password" or "new_password".

**Q.flash**

utils.js includes flash handling. Its set up automatically along with component and tags input handling.
See `The Flash fixture`_ for details, including required HTML.

.. code:: javascript
    
    Q.flash({
        message: "Something happened",
        class: "info"
    })

Note that if ``bootstrap`` JS is loaded before utils.js, ``bootstrap.Toast`` is used
and an additional ``title`` can be provided to ``Q.flash``

**Components**

This is a poor man version of HTMX. It allows using ajax-component tags that
are loaded via ajax and any form in those components will be trapped 
(i.e. the result of form submission will also be displayed inside the same component)

For example imagine an index.html that contains

.. code:: html

    <ajax-component id="component_1" url="[[=URL('mycomponent')]]">
        <blink>Loading...</blink>
    </ajax-component>

And a different action serving the component:

.. code:: python

    @action("mycomponent", method=["GET", "POST"])
    @action.uses(flash)
    def mycomponent():
        flash.set("Welcome")
        form = Form([Field("your_name")])
        return DIV(
            "Hello " + request.forms["your_name"]
            if form.accepted else form).xml()

A component action is a regular action except that it should generate html without the
```<html><body>...</body></html>``` envelop and it can make use of templates and flash for example.

Notice that if the main page supports flash messages, any flash message in the component will be displayed
by the parent page.

Moreover if the component returns a ``redirect("other_page")`` not just the content of the component,
but the entire page will be redirected.

The contents of the component html can contain ``<script>...</script>`` and they can modify global page variables
as well as modify other components. If a component script relies on global variables, and you also want to use
a component as a template macro, you can use ``<script type="module">...</script>`` - these will run after
all non-module scripts, ensuring all global variables are set. Take note that module sripts themselves have their
own scope, and need to set global variables through ``window.<global var name>``if neccessary.

**Global submit button**

This is a feature of ``<ajax-component>`` which allows a single global button to submit the Forms from 
multiple components simultaneously. If this is used, individual submit buttons are automatically removed
from the Forms.

.. code:: html

    <ajax-component id="component_1" url="[[=URL('mycomponent')]]" global-submit="submit-all">
        <blink>Loading...</blink>
    </ajax-component>
    <ajax-component id="component_1" url="[[=URL('mycomponent')]]" global-submit="submit-all">
        <blink>Loading...</blink>
    </ajax-component>
    
    <button ajax-component-global-submit id="submit-all">Submit</button>

As you can see ``<ajax-component>`` elements get a ``global-submit="submit-all"`` attribute.
``"submit-all"`` here is the ID of the button. For this to work, the button with the matching
ID needs the ``data-component-global-submit`` attribute. You can have multiple global submit 
buttons with different IDs handling different components, depending on
the components ``global-submit`` attribute.

.. note::
    Global submit handling will skip forms which have not had their
    inputs changed away from their defaultValue.

You can manually trigger this submit button with ``Q.triggerGlobalSubmit``.
There still needs to be a button, but this allows you to hide it from the user.

Global submit handling will attempt to flash error messages.
These can be translated by setting ``T.translations``.


The T object
~~~~~~~~~~~~

This is a Javascript reimplementation of the Python pluralize library in Python
which is used by the Python T object in py4web. So basically a client-side T.

.. code:: javascript

   T.translations = {'dog': {0: 'no cane', 1: 'un case', 2: '{n} cani', 10: 'tanti cani'}};
   var message = T('dog').format({n: 5}); // "5 cani"

The intended usage is to create a server endpoint that can provide translations
for the client accepted-language, obtain ``T.translations`` via ajax get, and then use 
T to translate and pluralize all messages clientside rather than serverside.
