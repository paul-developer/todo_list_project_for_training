$(document).ready(function() {
    $.ajaxSetup({"contentType":"application/json", "dataType":"json"});

    $("input[type!='button']").tooltip({
      "position": {"at": "right+5 top-5", "my": "left top"},
      "classes": {"ui-tooltip-content": "ui_tooltip_custom_content_style"},
    });

    let page_alert = function(text,is_error){
        $('.alert').hide();
        $('.alert_span').text(text);

        if (is_error){
          $('.alert_error').show();
        }
        else {
          $('.alert_info').show();
        }
    };

    let auth_problem_handler = function(from_server){

      if (!from_server){
        page_alert('Server error. Please try again later.','is_error');
      }
      else {
        switch (from_server['code']) {
          case "auth_fail":
            page_alert('Login and/or password is incorrect. Check fields and try again.');
            break;
          case "user_blocked":
            page_alert('This login has been blocked.');
            break;
          default:
            page_alert('Authentication error. Please try again later.','is_error');
        }
      }

      $('.login_form').css("cursor","auto");
      $('.submit_button').prop("disabled",false);
    };

    $('.submit_button').click(function(){
      $('.alert').hide();

      let user_input = {};
      user_input['user_name'] = $.trim($('input[name="user_name"]').val());
      user_input['password'] = $('input[name="password"]').val();

      if (user_input['user_name'] == '') {
        $('input[name="user_name"]').tooltip("open");
        return;
      }

      if (user_input['password'] == '') {
        $('input[name="password"]').tooltip("open");
        return;
      }

      $(this).prop("disabled",true);
      $('.login_form').css("cursor","wait");

      $.post('?run=login_run', JSON.stringify(user_input))
        .done(function(from_server) {
            if (from_server['status'] == 'ok') {
              document.location.replace('?run=index_page');
            }
            else {
              auth_problem_handler(from_server);
            }
        })
        .fail(() => auth_problem_handler());
    });

    $(document).keydown(function(event_obj){
      if (event_obj.key == 'Enter'){
        if ($('.submit_button').prop("disabled")) return;
        $('.submit_button').click();
      }
    });
});
