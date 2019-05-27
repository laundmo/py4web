(function(){

    var auth = { props: [], data: null, methods: {}};
    
    auth.data = function() {        
        var parts = window.location.href.split('/');
        var data = {
            page: parts[parts.length-1],
            next: utils.getQuery('next'),
            form: {},
            errors: {},
            user: null
        };
        return data;
    };
    
    auth.methods.go = function(page, no_history) {
        var url = window.location.href.substring(0, window.location.href.lastIndexOf('/')) + '/' + page;
        if (!no_history) history.pushState({'page': page}, null, url);
        if (page == 'register') 
            this.form = {email:'', password:'', password2:'', first_name:'', last_name: ''};
        else if (page == 'login') 
            this.form = {email:'', password:''};
        else if (page == 'request_reset_password') 
            this.form = {email:''};
        else if (page == 'reset_password') 
            this.form = {new_password:'', new_password2:''};
        else if (page == 'change_password') 
            this.form = {old_password:'', new_password:'', new_password2:''};
        else if (page == 'change_email') 
            this.form = {password: '', new_email:'', new_email2:''};
        else if (page == 'edit_profile') 
            this.form = {first_name:'', last_name: ''};        
        else this.form = {};
        this.errors = {}
        for(var key in this.form) this.errors[key] = null;
        this.page = page;
    };

    auth.methods.submit_login = function() {
        var self = this;
        axios.post('/_scaffold/auth/api/login', self.form).then(function(res){
                console.log(res);
                if(res.data.errors) self.errors = res.data.errors;
                else if (res.data.status=='error') alert(res.data.message);
                else window.location = self.next;
            });
    };
    auth.methods.submit_register = function() {
        var self = this;
        var form = utils.clone(this.form)
        delete form['password2']
        axios.post('/_scaffold/auth/api/register', form).then(function(res){
                if(res.data.errors) self.errors = res.data.errors;
                else if (res.data.status=='error') alert(res.data.message);
                else self.go('registered');
            });
    };
    auth.methods.submit_request_reset_password = function() {
        var self = this;
        axios.post('/_scaffold/auth/api/request_reset_password', this.form).then(function(res){
                if(res.data.errors) self.errors = res.data.errors;
                else if (res.data.status=='error') alert(res.data.message);
                else self.go('request_sent');
            });
    };
    auth.methods.submit_reset_password = function() {
        var self = this;
        axios.post('/_scaffold/auth/api/reset_password', this.form).then(function(res){
                if(res.data.errors) self.errors = res.data.errors;
                else if (res.data.status=='error') alert(res.data.message);
                else self.go('login');
            });        
    };
    auth.methods.submit_change_password = function() {
        var self = this;
        axios.post('/_scaffold/auth/api/change_password', this.form).then(function(res){
                if(res.data.errors) self.errors = res.data.errors;
                else if (res.data.status=='error') alert(res.data.message);
                else self.go('login');
            });        
    };
    auth.methods.submit_change_email = function() {
        var self = this;
        axios.post('/_scaffold/auth/api/change_email', this.form).then(function(res){
                if(res.data.errors) self.errors = res.data.errors;
                else if (res.data.status=='error') alert(res.data.message);
                else self.go('login');
            });        
    };
    auth.methods.submit_edit_profile = function() {
        var self = this;
        axios.post('/_scaffold/auth/api/edit_profile', this.form).then(function(res){
                if(res.data.errors) self.errors = res.data.errors;
                else if (res.data.status=='error') alert(res.data.message);
                else self.go('login');
            });        
    };
    auth.created = function() {
        var self = this;
        window.addEventListener('popstate', function (event) {
                self.go(event.state.page, true);
            }, false);
    };
    utils.register_vue_component('auth', 'components/auth.html', function(template) {
            auth.template = template.data;
            return auth;
        });
    
})();