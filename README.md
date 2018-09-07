angular-dpd
=================

A plugin for Angular that allows for easy interaction with deployd.
Usage is the same as the default dpd.js file, but requires configuration of the necessary collections.
Extra 'save' helper function added that will POST if the object has no 'id' and will put if it does.

Example usage
---------------------

```javascript
var app = angular.module('myApp',['dpd']);

// Configuration:
app.value('dpdConfig',['categories']);
// or
app.value('dpdConfig', { 
  collections: ['categories'], 
  serverRoot: 'http://someotherserver.com/', // optional, defaults to same server
  socketOptions: { reconnectionDelayMax: 3000 }, // optional socket io additional configuration
  useSocketIo: true // optional, defaults to false,
  useBearerAuth: true // optional, sets whether to use HTTP request header auth instead of cookies, defaults to false

});


app.controller('bodyController',function($scope, dpd){

  dpd.categories.get().then(function(data) { }).catch(function(error) { });
	
  dpd.categories.get('414b9c5cc315485d').then(function(data) { }).catch(function(error) { });
	
  // Example with an [advanced query](http://docs.deployd.com/docs/collections/reference/querying-collections.md#s-Advanced%20Queries-2035):
  dpd.categories.get($sort: {name: 1}, $limit: 10, rightsLevel: {$gt:0}}.then(function(data) { });
	
  // Promises are supported:
  dpd.categories.post({"value":"cat1","typeId":"987ad2e6d2bdaa9d"})
  .success(function (result) {
    // use result
  })
  .error(function (err) {
    // on error
  });
	
  dpd.categories.put('414b9c5cc315485d',{"value":"cat123"}).success(function(category){ }).error(function(error) { });
	
  dpd.categories.del('414b9c5cc315485d').success(function(category){ });
  
  // login a user
  dpd.users.exec('login', { username: 'user', password: 'pass' }).success(function(session) { }).error(function(err) { });
});
```
	
Socket.IO
---------------------

If socket.io is enabled in the configuration, it can be used like this:

```javascript
app.controller('bodyController',function($scope, dpd){
	dpd.categories.on($scope, "changed", function (result) { // this handles "categories:changed"
		console.log("event fired");
	}
	// or
	dpd.on($scope, "categories:changed", function (result) {
		console.log("event fired");
	}
}
```

For low-level access, the raw socket is exposed as `dpd.socket.rawSocket`.

Note: We inject $scope in the call so that the library can automatically remove the events if the $scope is $destroyed (such as when a route change occurs).
	
dpd.users
---------------------
The dpd.users collection traditionally allows access to several functions including
dpd.users.me(), dpd.users.login, dpd.users.logout.  These are currently not well supported, but may be used as follows:

##dpd.users.me()
use ```dpd.users.get('me')``` - this seems to work as long as your sid cookie is set

##dpd.users.login
use:
```
function login(user){
	// note the dependancies on dpdConfig, $http and $cookies.  
	// This returns a promise, so you can move $state.go to a .then() handler.
    return $http.post( dpdConfig.serverRoot + 'users/login', { username: user.username, password: user.password})
      .then(
      function(session, error) {
        if (error) {
          alert(error.message);
          return false;
        } else {
          $cookies.sid = session.data.id; // set the sid cookie
          $state.go('loginSuccess');
        }
      });
  }
```

## dpd.users.logout()
Use dpd.users.get('logout')
