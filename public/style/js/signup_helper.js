$(document).ready(() => {
    
    $('#newPassWordHelp').hide();
    $('#passWordStrength').hide();

    $('#new_password').on("input", validatePasswordStrength)

    $('#new_password').on("input", confirmPassword)
    $('#new_password_confirm').on("input", confirmPassword)

    $('#login_email').on("input", checkLoginFilledIn)
    $('#login_password').on("input", checkLoginFilledIn)

   
})

function validatePasswordStrength(){
    let password = $('#new_password').val();
    let strength = 0;
    let good;

    if(password.length > 6)
        strength++;

    if ((password.match(/[a-z]/)) && (password.match(/[A-Z]/)))
        strength++;

    if(password.match(/\d+/))
        strength++;

    if(password.match(/.[!,@,#,$,%,^,&,*,?,_,~,-,(,)]/))
        strength++;

    if (password.length > 10)
        strength++;

    switch (strength) {
        case 0:
            $('#progressBar')
            .attr('aria-valuenow', 0)
            .css('width', "0%")
            .addClass("bg-danger")
            .removeClass("bg-success")
            .removeClass("bg-info")
            $('#passWordStrength').show();
            good = false;
            break;

        case 1:
            $('#progressBar')
            .attr('aria-valuenow', 25)
            .css('width', "25%")
            .addClass("bg-danger")
            .removeClass("bg-success")
            .removeClass("bg-info")
            $('#passWordStrength').show();
            good = false;
            break;

        case 2:
            $('#progressBar')
            .attr('aria-valuenow', 50)
            .css('width', "50%")
            .addClass("bg-info")
            .removeClass("bg-danger")
            .removeClass("bg-sucess")
            $('#passWordStrength').hide();
            good = true;
            break;

        case 3:
            $('#progressBar')
            .attr('aria-valuenow', 75)
            .css('width', "75%")
            .addClass("bg-info")
            .removeClass("bg-danger")
            .removeClass("bg-success")
            $('#passWordStrength').hide();
            good = true; 
            break;

        case 4:
            $('#progressBar')
            .attr('aria-valuenow', 100)
            .css('width', "100%")
            .addClass("bg-success")
            .removeClass("bg-info")
            .removeClass("bg-danger")
            $('#passWordStrength').hide();
            good = true;
            break;
    }
    if(password == "" ){
        $('#passWordStrength').hide();
    }
    return good;
}

function confirmPassword(){
    let password = $('#new_password').val();  
    let confirm = $('#new_password_confirm').val();

    if(password != confirm){
        $('#newPassWordHelp').show();
        $('#newUser').prop("disabled", true);
    }
        
    if(password == confirm){
        $('#newPassWordHelp').hide();

        if(validatePasswordStrength()){
            $('#newUser').prop("disabled", false);
        }
    }
}

function checkLoginFilledIn(){
    let email = $('#login_email').val();
    let password = $('#login_password').val();

    if (email != "" && password != "")
        $('#login_submit').prop("disabled", false);
    else 
        $('#login_submit').prop("disabled", true);
}