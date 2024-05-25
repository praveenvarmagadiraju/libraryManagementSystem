*imported Express,mongodb and Jwt tokens

Mongodb Connection:
I am using my own clustur Url for creating db and the collections.
collections : books , borrows , products , users

*Created Mongodb Schemas 
1.userSchema 2. bookSchema 3.borrowSchema

*created modals for these schemas

API's : 
*created Api to register the user with name, email and password.
*created Api to Login with the email and password.
     * validating the email and password
     * created JWT Tokens for Authentication purpose.
*created Api to get All the registered Users and provided only admin access to it.
*created Apis to add the book,update the book and delete it in to DB Books collection and I provided only admin access.
*Created Api to get all the books so that member can view allthe books and its details
*created Apis to borrow a book , return back the book for the member(i.e if some one borrow we are decreasing book count to -1,if return back adding book count +1)
*created Apis for borrows history, most borrowed books  provided with only admin access.
*create Api to get the details of Most Active members and provide it with only admin access.
*create api for book availability 

LocalHost : 
* Running the LocalHost in 3000



