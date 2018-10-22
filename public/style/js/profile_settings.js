$('#profilePictureFile').on('change', function () {
    let fileName = $(this).val().split('\\').pop();
    $(this).next('#profilePictureFile').addClass("selected").html("Chosen Image: " + fileName);
    readURLPP(this);
});

$('#profileBannerFile').on('change', function () {
    let fileName = $(this).val().split('\\').pop();
    $(this).next('#profileBannerFile').addClass("selected").html("Chosen Image: " + fileName);
    readURLPB(this);
});

function readURLPP(input) {
    console.log("Input.files", input)
    if (input.files && input.files[0]) {
        var reader = new FileReader();

        reader.onload = function (e) {
            $('#profile_image_holder').attr('src', e.target.result);
        }

        reader.readAsDataURL(input.files[0]);
    }
}

function readURLPB(input) {
    console.log("Input.files", input)
    if (input.files && input.files[0]) {
        var reader = new FileReader();

        reader.onload = function (e) {
            $('#profile_header').css('background-image', `url(${e.target.result})`);
        }

        reader.readAsDataURL(input.files[0]);
    }
}

