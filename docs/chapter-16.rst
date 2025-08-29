============================
Advanced topics and examples
============================

The scheduler
-------------

Py4web has a built-in scheduler. There is nothing for you to install or configure to make it work.

Given a task (just a python function), you can schedule async runs of that function.
The runs can be a one-off or periodic. They can have timeout. They can be scheduled to run at a given scheduled time.

The scheduler works by creating a table ``task_run`` and enqueueing runs of the predefined task as table records.
Each ``task_run`` references a task and contains the input to be passed to that task. The scheduler will capture the
task stdout+stderr in a ``db.task_run.log`` and the task output in ``db.task_run.output``.

A py4web thread loops and finds the next task that needs to be executed. For each task it creates a worker process
and assigns the task to the worker process. You can specify how many worker processes should run concurrently.
The worker processes are daemons and they only live for the life of one task run. Each worker process is only
responsible for executing that one task in isolation. The main loop is responsible for assigning tasks and timeouts.

The system is very robust because the only source of truth is the database and its integrity is guaranteed by
transactional safety. Even if py4web is killed, running tasks continue to run unless they complete, fail, or are
explicitly killed.

Aside for allowing multiple concurrent task runs in execution on one node,
it is also possible to run multiple instances of the scheduler on different computing nodes,
as long as they use the same client/server database for ``task_run`` and as long as
they all define the same tasks.

Here is an example of how to use the scheduler:

.. code:: python

   from pydal.tools.scheduler import Scheduler, delta, now
   from .common import db

   # create and start the scheduler
   scheduler = Scheduler(db, sleep_time=1, max_concurrent_runs=1)
   scheduler.start()

   # register your tasks
   scheduler.register_task("hello", lambda **inputs: print("hi!"))
   scheduler.register_task("slow", lambda: time.sleep(10))
   scheduler.register_task("periodic", lambda **inputs: print("I am periodic!"))
   scheduler.register_task("fail", lambda x: 1 / x)
   
   # enqueue some task runs:
   
   scheduler.enqueue_run(name="hello")
   scheduler.enqueue_run(name="hello", scheduled_for=now() + delta(10) # start in 10 secs
   scheduler.enqueue_run(name="slow", timeout=1) # 1 secs
   scheduler.enqueue_run(name="periodic", period=10) # 10 secs
   scheduler.enqueue_run(name="fail", inputs={"x": 0})

Notice that in scaffolding app, the scheduler is created and started in common if
``USE_SCHEDULER=True`` in ``settings.py``.

You can manage your task runs busing the dashboard or using a ``Grid(db.task_run)``.

To prevent database locks (in particular with sqlite) we recommend:

- Use a different database for the scheduler and everything else
- Always ``db.commit()`` as soon as possible after any insert/update/delete
- wrap your database logic in tasks in a try...except as in

.. code:: python

   def my_task():
       try:
           # do something
           db.commit()
       except Exception:
           db.rollback()


Sending messages using a background task
----------------------------------------

As en example of application of the above, consider the case of wanting to send emails asynchronously from a background task.
In this example we send them using SendGrid from Twilio (https://www.twilio.com/docs/sendgrid/for-developers/sending-email/quickstart-python).

Here is a possible scheduler task to send the email:

.. code:: python

    import sendgrid
    from sendgrid.helpers.mail import Mail, Email, To, Content

    def sendmail_task(from_addr, to_addrs, subject, body):
        ""
        # build the messages using sendgrid API
        from_email = Email(from_addr)  # Must be your verified sender
        content_type = "text/plain" if body[:6] != "<html>" else "text/html"
        content = Content(content_type, body)
        mail = Mail(from_email, To(to_addrs), subject, content)
        # ask sendgrid to deliver it
        sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        response = sg.client.mail.send.post(request_body=mail.get())
        # check if worked
        assert response.status_code == "200"

    # register the above task with the scheduler
    scheduler.register_task("sendmail", sendmail_task)


To schedule sending a new email do:

.. code:: python

    email = {
        "from_addr": "me@example.com",
        "to_addrs": ["me@example.com"], 
        "subject": "Hello World",
        "body": "I am alive!",
    }
    scheduler.enqueue_run(name="sendmail", inputs=email, scheduled_for=None)

The key:value in the email representation must match the arguments of the task.
The ``scheduled_for`` argument is optional and allows you to specify when the email should be sent.
You can use the Dashboard to see the status of your ``task_run`` for the task called ``sendmail``.

You can also tell auth to tap into above mechanism for sending emails:

.. code:: python

    class MySendGridSender:
        def __init__(self, from_addr):
            self.from_addr = from_adds
        def send(self, to_addr, subject, body):
            email = {
                "from_addr": self.from_addr,
                "to_addrs": [to_addr], 
                "subject": subject,
                "body": body,
            }
            scheduler.enqueue_run(name="sendmail", inputs=email)

    auth.sender = MySendGridSender(from_addr="me@example.com")

With the above, Auth will not send emails using smtplib. Instead it will send them with SendGrid using the scheduler.
Notice the only requirement here is that ``auth.sender`` must be an object with a ``send`` method with the same signature as in the example.

Notice, it it also possible to send SMS messages instead of emails but this requires 1) store the phone number in ``auth_user`` and 2) override the ``Auth.send`` method.


Celery
------

Yes. You can use Celery instead of the build-in scheduler but it adds complexity and it is less robust.
Yet the build-in scheduler is designed for long running tasks and the database can become a bottleneck
if you have hundreds of tasks running concurrently. Celery may work better if you have more than 100 concurrent
tasks and/or they are short running tasks.


py4web and asyncio
------------------

Asyncio is not strictly needed, at least for most of the normal use
cases where it will add problems more than value because of its concurrency model.
On the other hand, we think py4web needs a built-in websocket async based solution.

If you plan to play with asyncio be careful that you should also deal with all
the framework's components: in particular pydal is not asyncio compliant because
not all the adapters work with async.

htmx
----

There are many javascript front-end frameworks available today that allow you great flexibility
over how you design your web client. Vue, React and Angular are just a few.  However, the
complexity in building one of these systems prevents many developers from reaping those benefits. 
Add to that the rapid state of change in the ecosystem and you soon have an application that is
difficult to maintain just a year or two down the road.

As a consequence, there is a growing need to use simple html elements to add reactivity to your web
pages. htmx is one of the tools emerging as a leader in page reactivity without the complexities of javascript.
Technically, htmx allows you to access AJAX, CSS Transitions, Web Sockets and Server Sent Events directly
in HTML, using attributes, so you can build modern user interfaces with the simplicity and power of hypertext.
[CIT1601]_

Read all about htmx and its capabilities on the official site at https://htmx.org . If you prefer,
there is also a video tutorial: `Simple, Fast Frontends With htmx <https://www.youtube.com/watch?v=cBfz4W_KvEI>`__ .


py4web enables htmx integration in a couple of ways.

#. Allow you to add htmx attributes to your forms and buttons
#. Includes an htmx attributes plugin for the py4web grid

htmx usage in Form
~~~~~~~~~~~~~~~~~~

The py4web Form class allows you to pass \**kwargs to it that will be passed along as attributes to the html
form. For example, to add the hx-post and hx-target to the <form> element you would use:

.. code:: python

    attrs = {
        "_hx-post": URL("url_to_post_to/%s" % record_id),
        "_hx-target": "#detail-target",
    }
    form = Form(
        db.tablename,
        record=record_id,
        **attrs,
    )

Now when your form is submitted it will call the URL in the hx-post attribute and whatever is returned
to the browser will replace the html inside of the element with id="detail-target".

Let's continue with a full example (started from scaffold).

**controllers.py**

.. code:: python

    import datetime

    @action("htmx_form_demo", method=["GET", "POST"])
    @action.uses("htmx_form_demo.html")
    def htmx_form_demo():
        return dict(timestamp=datetime.datetime.now())


    @action("htmx_list", method=["GET", "POST"])
    @action.uses("htmx_list.html", db)
    def htmx_list():
        superheros = db(db.superhero.id > 0).select()
        return dict(superheros=superheros)


    @action("htmx_form/<record_id>", method=["GET", "POST"])
    @action.uses("htmx_form.html", db)
    def htmx_form(record_id=None):
        attrs = {
            "_hx-post": URL("htmx_form/%s" % record_id),
            "_hx-target": "#htmx-form-demo",
        }
        form = Form(db.superhero, record=db.superhero(record_id), **attrs)
        if form.accepted:
            redirect(URL("htmx_list"))

        cancel_attrs = {
            "_hx-get": URL("htmx_list"),
            "_hx-target": "#htmx-form-demo",
        }
        form.param.sidecar.append(A("Cancel", **cancel_attrs))

        return dict(form=form)

**templates/htmx_form_demo.html**

.. code:: html

    [[extend 'layout.html']]

    [[=timestamp]]
    <div id="htmx-form-demo">
        <div hx-get="[[=URL('htmx_list')]]" hx-trigger="load" hx-target="#htmx-form-demo"></div>
    </div>

    <script src="https://unpkg.com/htmx.org@1.3.2"></script>

**templates/htmx_list.html**

.. code:: html

    <ul>
    [[for sh in superheros:]]
        <li><a hx-get="[[=URL('htmx_form/%s' % sh.id)]]" hx-target="#htmx-form-demo">[[=sh.name]]</a></li>
    [[pass]]
    </ul>

**templates/htmx_form.html**

.. code:: html

    [[=form]]


We now have a functional maintenance app to update our superheros.  In your browser navigate to the htmx_form_demo page
in your new application.  The hx-trigger="load" attribute on the inner div of the htmx_form_demo.html page
loads the htmx_list.html page inside the htmx-form-demo DIV once the htmx_form_demo page is loaded.

Notice the timestamp added outside of the htmx-form-demo DIV does not change when transitions occur.  This is
because the outer page is never reloaded, only the content inside the htmx-form-demo DIV.

The htmx attributes hx-get and hx-target are then used on the anchor tags to call the htmx_form page to
load the form inside the htmx-form-demo DIV.

So far we've just seen standard htmx processing. Nothing fancy here, and nothing specific to py4web. However,
in the htmx_form method we see how you can pass any attribute to a py4web form that will be rendered on the
<form> element as we add the hx-post and hx-target. This tells the form to allow htmx to override the default
form behavior and to render the resulting output in the target specified.

The default py4web form does not include a Cancel button in case you want to cancel out of the edit form. But
you can add 'sidecar' elements to your forms. You can see in htmx_form that we add a cancel option and add the
required htmx attributes to make sure the htmx_list page is rendered inside the htmx-form-demo DIV.


htmx usage in Grid
~~~~~~~~~~~~~~~~~~

The py4web grid provides an attributes plugin system that allows you to build plugins to provide custom attributes
for form elements, anchor elements or confirmation messages. py4web also provide an attributes plugin specifically for
htmx.

Here is an example building off the previous htmx forms example.

**controller.py**

.. code:: python

    @action("htmx_form/<record_id>", method=["GET", "POST"])
    @action.uses("htmx_form.html", db)
    def htmx_form(record_id=None):
        attrs = {
            "_hx-post": URL("htmx_form/%s" % record_id),
            "_hx-target": "#htmx-form-demo",
        }
        form = Form(db.superhero, record=db.superhero(record_id), **attrs)
        if form.accepted:
            redirect(URL("htmx_list"))

        cancel_attrs = {
            "_hx-get": URL("htmx_list"),
            "_hx-target": "#htmx-form-demo",
        }
        form.param.sidecar.append(A("Cancel", **cancel_attrs))

        return dict(form=form)

    @action("htmx_grid")
    @action.uses( "htmx_grid.html", session, db)
    def htmx_grid():
        grid = Grid(db.superhero, auto_process=False)

        grid.attributes_plugin = AttributesPluginHtmx("#htmx-grid-demo")
        attrs = {
            "_hx-get": URL(
                "htmx_grid",
            ),
            "_hx-target": "#htmx-grid-demo",
        }
        grid.param.new_sidecar = A("Cancel", **attrs)
        grid.param.edit_sidecar = A("Cancel", **attrs)

        grid.process()

        return dict(grid=grid)

**templates/htmx_form_demo.html**

.. code:: html

    [[extend 'layout.html']]

    [[=timestamp]]
    <div id="htmx-form-demo">
        <div hx-get="[[=URL('htmx_list')]]" hx-trigger="load" hx-target="#htmx-form-demo"></div>
    </div>

    <div id="htmx-grid-demo">
        <div hx-get="[[=URL('htmx_grid')]]" hx-trigger="load" hx-target="#htmx-grid-demo"></div>
    </div>

    <script src="https://unpkg.com/htmx.org@1.3.2"></script>

Notice that we added the #htmx-grid-demo DIV which calls the htmx_grid route.

**templates/htmx_grid.html**

.. code:: html

    [[=grid.render()]]

In htmx_grid we take advantage of deferred processing on the grid. We setup a standard CRUD grid, defer
processing and then tell the grid we're going to use an alternate attributes plugin to build our navigation.
Now the forms, links and delete confirmations are all handled by htmx.

Autocomplete Widget using htmx
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

htmx can be used for much more than just form/grid processing. In this example we'll take advantage of htmx and the
py4web form widgets to build an autocomplete widget that can be used in your forms. *NOTE: this is just an example, none
of this code comes with py4web*

Again we'll use the superheros database as defined in the examples app.

Add the following to your controllers.py.  This code will build your autocomplete dropdowns as well as
handle the database calls to get your data.

.. code:: python

    import json
    from functools import reduce

    from yatl import DIV, INPUT, SCRIPT

    from py4web import action, request, URL
    from ..common import session, db, auth


    @action(
        "htmx/autocomplete",
        method=["GET", "POST"],
    )
    @action.uses(
        "htmx/autocomplete.html",
        session,
        db,
        auth.user,
    )
    def autocomplete():
        tablename = request.params.tablename
        fieldname = request.params.fieldname
        autocomplete_query = request.params.query

        field = db[tablename][fieldname]
        data = []

        fk_table = None

        if field and field.requires:
            fk_table = field.requires.ktable
            fk_field = field.requires.kfield

            queries = []
            if "_autocomplete_search_fields" in dir(field):
                for sf in field._autocomplete_search_fields:
                    queries.append(
                        db[fk_table][sf].contains(
                            request.params[f"{tablename}_{fieldname}_search"]
                        )
                    )
                query = reduce(lambda a, b: (a | b), queries)
            else:
                for f in db[fk_table]:
                    if f.type in ["string", "text"]:
                        queries.append(
                            db[fk_table][f.name].contains(
                                request.params[f"{tablename}_{fieldname}_search"]
                            )
                        )

                query = reduce(lambda a, b: (a | b), queries)

            if len(queries) == 0:
                queries = [db[fk_table].id > 0]
                query = reduce(lambda a, b: (a & b), queries)

            if autocomplete_query:
                query = reduce(lambda a, b: (a & b), [autocomplete_query, query])
            data = db(query).select(orderby=field.requires.orderby)

        return dict(
            data=data,
            tablename=tablename,
            fieldname=fieldname,
            fk_table=fk_table,
            data_label=field.requires.label,
        )

    class HtmxAutocompleteWidget:
        def __init__(self, simple_query=None, url=None, **attrs):
            self.query = simple_query
            self.url = url if url else URL("htmx/autocomplete")
            self.attrs = attrs

            self.attrs.pop("simple_query", None)
            self.attrs.pop("url", None)

        def make(self, field, value, error, title, placeholder="", readonly=False):
            #  TODO: handle readonly parameter
            control = DIV()
            if "_table" in dir(field):
                tablename = field._table
            else:
                tablename = "no_table"

            #  build the div-hidden input field to hold the value
            hidden_input = INPUT(
                _type="text",
                _id="%s_%s" % (tablename, field.name),
                _name=field.name,
                _value=value,
            )
            hidden_div = DIV(hidden_input, _style="display: none;")
            control.append(hidden_div)

            #  build the input field to accept the text

            #  set the htmx attributes

            values = {
                "tablename": str(tablename),
                "fieldname": field.name,
                "query": str(self.query) if self.query else "",
                **self.attrs,
            }
            attrs = {
                "_hx-post": self.url,
                "_hx-trigger": "keyup changed delay:500ms",
                "_hx-target": "#%s_%s_autocomplete_results" % (tablename, field.name),
                "_hx-indicator": ".htmx-indicator",
                "_hx-vals": json.dumps(values),
            }
            search_value = None
            if value and field.requires:
                row = (
                    db(db[field.requires.ktable][field.requires.kfield] == value)
                    .select()
                    .first()
                )
                if row:
                    search_value = field.requires.label % row

            control.append(
                INPUT(
                    _type="text",
                    _id="%s_%s_search" % (tablename, field.name),
                    _name="%s_%s_search" % (tablename, field.name),
                    _value=search_value,
                    _class="input",
                    _placeholder=placeholder if placeholder and placeholder != "" else "..",
                    _title=title,
                    _autocomplete="off",
                    **attrs,
                )
            )

            control.append(DIV(_id="%s_%s_autocomplete_results" % (tablename, field.name)))

            control.append(
                SCRIPT(
                    """
            htmx.onLoad(function(elt) {
                document.querySelector('#%(table)s_%(field)s_search').onkeydown = check_%(table)s_%(field)s_down_key;
                \n
                function check_%(table)s_%(field)s_down_key(e) {
                    if (e.keyCode == '40') {
                        document.querySelector('#%(table)s_%(field)s_autocomplete').focus();
                        document.querySelector('#%(table)s_%(field)s_autocomplete').selectedIndex = 0;
                    }
                }
            })
                """
                    % {
                        "table": tablename,
                        "field": field.name,
                    }
                )
            )

            return control

Usage - in your controller code, this example uses bulma as the base css formatter.

.. code:: python

    formstyle = FormStyleFactory()
    formstyle.classes = FormStyleBulma.classes
    formstyle.class_inner_exceptions = FormStyleBulma.class_inner_exceptions
    formstyle.widgets["vendor"] = HtmxAutocompleteWidget(
        simple_query=(db.vendor.vendor_type == "S")
    )

    form = Form(
        db.product,
        record=product_record,  # defined earlier in controller
        formstyle=formstyle,
    )

First, get an instance of FormStyleFactory.  Then get the base css classes from whichever css framework you wish. Add
the class inner exceptions from your css framework. Once this is set up you can override the default widget for a
field based on its name.  In this case we're overriding the widget for the 'vendor' field. Instead of including all
vendors in the select dropdown, we're limiting only to those with a vendor type equal to 'S'.

When this is rendered in your page, the default widget for the vendor field is replaced with the widget generated by
the HtmxAutocompleteWidget. When you pass a simple query to the HtmxAutocompleteWidget the widget will use the default
route to fill the dropdown with data.

If using the simple query and default build url, you are limited to a simple DAL query. You cannot use DAL subqueries
within this simple query.  If the data for the dropdown requires a more complex DAL query you can override the default
data builder URL to provide your own controller function to retrieve the data.


.. [CIT1601] from the https://htmx.org website


.. _altcha_captcha:

Adding a Captcha Solution with Altcha
-------------------------------------

This section provides a simple captcha implementation for your py4web applications using the **Altcha** library. While not exhaustively tested, it serves as a practical example for integrating a robust, client-side captcha solution.
More information in https://altcha.org

Prerequisites
^^^^^^^^^^^^^

First, you need to install the Altcha library. You can do this using pip:

.. code-block:: bash

   python3 -m pip install --upgrade altcha

You also need a secret key for HMAC verification. It's recommended to store this in your application's settings. For this example, we'll assume you have a file like ``.settings.py`` with the following variable:

.. code-block:: python

   # .settings.py
   ALTCHA_HMAC_KEY = "your-very-secret-key-here"

Controller Logic
^^^^^^^^^^^^^^^^

Next, you need to add the necessary actions to your controller file. The following code provides two actions: one to generate the captcha challenge (``altcha``) and another to handle a form with the captcha (``some_form``).

.. code-block:: python

   # controllers/default.py
   from altcha import (
       create_challenge,
       verify_solution,
       ChallengeOptions,
   )
   from py4web import action, response, request, URL, Field, flash, Form
   from py4web.utils.form import XML, T
   from .settings import ALTCHA_HMAC_KEY

   @action("altcha", method=["GET"])
   def get_altcha():
       """Generates and returns an Altcha challenge."""
       try:
           challenge = create_challenge(
               ChallengeOptions(
                   hmac_key=ALTCHA_HMAC_KEY,
                   max_number=50000,
               )
           )
           response.headers["Content-Type"] = "application/json"
           return challenge.__dict__
       except Exception as e:
           response.status = 500
           return {"error": f"Failed to create challenge: {str(e)}"}

   @action.uses("form_altcha.html", session, flash)
   def some_form():
       """An example form that uses the Altcha captcha."""
       fields = [
           Field("name", requires=IS_NOT_EMPTY()),
           Field("color", type="string", requires=IS_IN_SET(["red", "blue", "green"])),
       ]
       form = Form(fields,
                   csrf_session=session,
                   submit_button=T("Submit"))

       # Insert the Altcha widget HTML before the submit button
       form.structure.insert(-1, XML('<altcha-widget></altcha-widget></br>'))

       if form.accepted:
           altcha_payload = request.POST.get("altcha")
           if not altcha_payload:
               response.status = 400
               flash.set("NO ALTCHA payload")
               print("NO ALTCHA payload")
           else:
               ok, error = verify_solution(altcha_payload, ALTCHA_HMAC_KEY)
               if not ok:
                   response.status = 400
                   flash.set(f"ALTCHA verification fail: {error}")
                   print("ALTCHA verification fail:", error)
               else:
                   flash.set("ALTCHA verified.")

       return dict(form=form)

View Templates
^^^^^^^^^^^^^^

You need to include the Altcha JavaScript library and configure the widget in your HTML templates.

``form_altcha.html``
""""""""""""""""""""

This template works with the ``some_form`` action. It loads the Altcha script and sets the ``challengeurl`` attribute to point to our ``altcha`` action.

.. code-block:: html

   [[extend 'layout.html']]

   <script async defer src="https://cdn.jsdelivr.net/gh/altcha-org/altcha/dist/altcha.min.js" type="module"></script>
   <script>
       document.addEventListener("DOMContentLoaded", function () {
           const altchaWidget = document.querySelector("altcha-widget");
           if (altchaWidget) {
               altchaWidget.setAttribute("challengeurl", "[[=URL('altcha')]]");
           }
       });
   </script>
   <div class="section">
       <div class="vars">[[=form]]</div>
   </div>

Custom Auth Form
""""""""""""""""

For a custom authentication form, you can follow a similar approach. Make sure to insert the ``<altcha-widget>`` tag into the form's structure and include the necessary JavaScript.

.. code-block:: html

   [[extend "layout.html"]]
   <script async defer src="https://cdn.jsdelivr.net/gh/altcha-org/altcha/dist/altcha.min.js" type="module"></script>

   <script>
       document.addEventListener("DOMContentLoaded", function () {
           const altchaWidget = document.querySelector("altcha-widget");
           if (altchaWidget) {
               altchaWidget.setAttribute("challengeurl", "[[=URL('altcha')]]");
           }
       });
   </script>
   <style>
       .auth-container {
           max-width: 80%;
           min-width: 400px;
           margin-left: auto;
           margin-right: auto;
           border: 1px solid #e1e1e1;
           border-radius: 10px;
           padding: 20px;
       }
   </style>

   [[form.structure.insert(-1,XML('<altcha-widget></altcha-widget></br>'))]]

   <div class="auth-container">[[=form]]</div>

To enable Altcha in the auth form, you can use the following fixture:

.. code-block:: python

    class AltchaServerFixture(Fixture):
        def __init__(self, hmac_key=ALTCHA_HMAC_KEY):
            super().__init__()
            self._name = "altcha_server"
            self.hmac_key = hmac_key

        def on_success(self, context):
            # Only verify Altcha for POST requests
            if request.method != "POST":
                return
            payload = request.POST.get("altcha")
            if not payload:
                raise HTTP(400, "ALTCHA payload not received")
            try:
                verified, err = verify_solution(payload, self.hmac_key, True)
                if not verified:
                    raise HTTP(400, "Invalid ALTCHA")
                return {"success": True, "message": "Altcha verification passed"}
            except Exception as e:
                raise HTTP(500, "Exception in Altcha verification")

        @property
        def name(self):
            return self._name

Make sure ``AltchaServerFixture`` is accessible in ``common.py`` where ``auth`` is instantiated:

.. code-block:: python

    from .fixtures import AltchaServerFixture
    auth.enable(uses=(session, T, db, AltchaServerFixture()), env=dict(T=T))

This will ensure Altcha verification is performed for POST requests in your authentication forms.

You can also use the ``AltchaServerFixture`` in a form:

.. code-block:: python

    @action('other_form', method=['GET', 'POST'])
    @action.uses('form_altcha.html', session, flash, AltchaServerFixture())
    def other_form():
        fields = [
            Field("name", requires=IS_NOT_EMPTY()),
            Field("color", type="string", requires=IS_IN_SET(["red","blue","green"])),
        ]
        form = Form(fields, 
                    csrf_session=session, 
                    submit_button=T("Submit"))
        antes_submit = len(form.structure) - 3
        form.structure.insert(antes_submit, XML('<altcha-widget></altcha-widget></br>'))
        if form.accepted:
            # You can assume here that the Altcha payload was verified by the fixture
            flash.set("Form and Altcha successfully verified.")
            # Process the form data here
        return dict(form=form)