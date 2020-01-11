$(document).ready(function() {
    $.ajaxSetup({"contentType":"application/json", "dataType":"json"});

    function get_datetime_arr(time_str) {
      let obj = time_str ? new Date(time_str+':00') : new Date();

      let month = (obj.getMonth()+1).toString();
      if(month.length < 2) month = '0'+month;

      let day = (obj.getDate().toString().length > 1) ? obj.getDate() : '0'+obj.getDate();
      let hour = (obj.getHours().toString().length > 1) ? obj.getHours() : '0'+obj.getHours();
      let minute = (obj.getMinutes().toString().length) > 1 ? obj.getMinutes() : '0'+obj.getMinutes();
      return [
        obj.getFullYear()+'-'+month+'-'+day,
        hour+':'+minute,
        obj.getFullYear()+'-'+month+'-'+day+' '+hour+':'+minute,
      ];
    };

    function get_timezone (){
      let timezone = ((new Date().getTimezoneOffset() / 60) * -1);
      if (timezone == 0) return '0';
      return (timezone > 0) ? '+'+timezone : ''+timezone;
    };

    let page_alert_timer;
    function page_alert (text,is_error){
        clearTimeout(page_alert_timer);

        $('.alert').stop(true,true).hide();
        $('.alert_span').html(text);
        let visible_time = 5000;

        if (is_error){
          $('.alert_error').show();
          visible_time = 10000;
        }
        else {
          $('.alert_info').show();
        }

        page_alert_timer = setTimeout(() => {
          $('.alert:visible').hide('fade',5000);
        },visible_time);
    };

    function api_problem_handler (from_server){
      if (!from_server){
        page_alert('Server error. Please try again later.','is_error');
      }
      else {
        switch (from_server['code']) {
          case "auth_fail":
            $('.login_expired_msg').dialog({
              'width': 600, 'height': 300, 'modal': true,
              'buttons': {
                'Refresh page now!': dial_event_obj => {
                  document.location.reload(true);
                },
                'Close this message': function() {$(this).dialog('close')}
              },
            });
            $('.user_name').css("color","orange").text('SESSION HAS EXPIRED');
            break;
          case "tdl_duble_name":
              page_alert('This name is already exist');
            break;
          case "todolist_not_found":
              page_alert('This TODO List not found in the database<br>Please refresh the page for to get the actual list of TODO Lists');
            break;
          case "some_todolist_not_found":
              page_alert('Some of the sortable TODO Lists were not found in the database or on your page<br>Please refresh the page for to get the actual list of TODO Lists');
            break;
          case "task_not_found":
              page_alert('This task not found in the database<br>Please reopen the TODO List for to get the actual list of tasks');
            break;
          case "some_tasks_not_found":
              page_alert('Some of the sortable tasks were not found in the database or on your page<br>Please reopen the TODO List for to get the actual list of tasks');
            break;
          default:
            page_alert('Server error. Please try again later.','is_error');
        }
      }
    }

    function textarea_auto_resize (textarea,resize_now) {
      let min_height = parseInt($(textarea).css("min-height"),10);

      let run_code = () => {
        $(textarea).height("auto");
        if (textarea.scrollHeight > (min_height*1.5)) {
          $(textarea).innerHeight(textarea.scrollHeight);
        }
        else {
          $(textarea).innerHeight(min_height);
        }
      };

      run_code();

      if (resize_now) return;

      if($(textarea).data("textarea_auto_resize")) return;
      $(textarea).data("textarea_auto_resize",true);

      let refresh_timer;
      $(textarea)
        .on('scroll',run_code)
        .on('cut',() => {setTimeout(run_code,200)})
        .on('keyup',() => {
          clearTimeout(refresh_timer);
          refresh_timer = setTimeout(run_code,500);
        });
    }

    let templates_storage = $('.templates_storage');

    $(".add_tdl_form_input, .edit_tdl_form_input, .adtsk_form_input, .edtsk_form_input, input[type='date'], input[type='time']")
      .tooltip({
        "position": {"at":"right+5 top-5","my":"left top"},
        "classes": {"ui-tooltip-content":"tooltip_custom_content_style"},
        "disabled": true,
      })
      .on('change', event_obj => {
        $(event_obj.target).tooltip("option","disabled",true);
      });

    $('.alert').on('mouseenter',event_obj => {
      clearTimeout(page_alert_timer);
      $(event_obj.currentTarget).stop(true,true).show();
    });

    $('.alert_close_button')
      .on('click',() => $('.alert').hide())
      .tooltip({"position":{"at":"right+5 top-5","my":"left top"}});

    $('.tdl_add_btn').on('click',() => {
      let form_input = $('.add_tdl_form_input');
      let dialog_obj = $('.add_tdl_form').dialog({
          'width': 500, 'height': 200, 'modal': true,
          'buttons': {
            'Create TODO List': () => {
              $('.alert').hide();

              let input_val = $.trim($(form_input).val());
              if (input_val == '') {
                $(form_input).tooltip("option","disabled",false).tooltip('open');
                return false;
              }

              $.post('?run=todolist_add_run',JSON.stringify({'tdl_name': input_val}))
                .done(function(from_server) {
                    if (from_server['status'] == 'ok') {
                      todolist_render([from_server['data']]);
                      if ($(todo_lists_root).children('.to_do_list').length == 1) {
                        show_task_list(from_server['data']['id']);
                      }
                      $(dialog_obj).dialog('close');
                    }
                    else {
                      api_problem_handler(from_server);
                    }
                })
                .fail(() => api_problem_handler());
            },
            'Cancel': () => $(dialog_obj).dialog('close'),
          },
          'close': () => {
            $(form_input).val('').tooltip("option","disabled",true);
            $('.alert').hide();
          },
      });
    })
    .button();

    $('.taskel_selected_del_close')
      .tooltip({"position":{"at":"right+5 top-5","my":"left top"}})
      .on('click',() => {
        $('.taskel_del_selector:checked').prop("checked",false);
        $('.taskel_content_div_remove_selected').removeClass('taskel_content_div_remove_selected');
        $('.taskel_selected_del').hide();
      });

    $('.taskel_selected_del_button').on('click',event_obj => {
      let taskel_many_obj = $('.taskel_del_selector:checked').parents('.task_element');
      let taskel_count = $(taskel_many_obj).length;

      let dialog_obj = $('.del_many_task_confirm').dialog({
        'width': 600, 'height': 250, 'modal': true,
        'open': () => {
          $('.del_task_quantity').text(taskel_count);
        },
        'buttons': {
          'Delete': dial_event_obj => {
            let taskel_id_arr = $.makeArray($(taskel_many_obj).map((i, el_obj) => {
              return $(el_obj).data('attrs')['id'];
            }));

            $.post('?run=tasklist_delete_run',JSON.stringify({"task_del_arr":taskel_id_arr}))
              .done(function(from_server) {
                  if (from_server['status'] == 'ok') {
                    let tdl_many_obj = $(taskel_many_obj).parents('.to_do_list');

                    $(taskel_many_obj).remove();

                    tdl_many_obj.each((i, tdl_obj) => {
                      if($(tdl_obj).find('.task_element').length == 0){
                        $(tdl_obj).find('.taskel_load').text('The TODO List is empty').show();
                      }
                    });

                    $('.taskel_selected_del').hide();
                    $(dialog_obj).dialog('close');

                    if ((taskel_count == 1) && (parseInt(from_server['data']['del_count']) == 0)) {
                      page_alert('This task were not found in the database, but it has deleted from the page<br>Please reopen the TODO List(s) for to get the actual list(s) of tasks');
                    } else if (parseInt(from_server['data']['del_count']) != taskel_count) {
                      page_alert('Some of the deleted tasks were not found in the database, but they were deleted from the page<br>Please reopen the TODO List(s) for to get the actual list(s) of tasks');
                    }
                  }
                  else {
                    api_problem_handler(from_server);
                  }
              })
              .fail(() => api_problem_handler());
          },
          'Cancel': () => $(dialog_obj).dialog('close'),
        },
      });
    }).button();

    let todo_lists_root = $('.todo_lists_root');

    $(todo_lists_root).sortable({
      "axis": "y",
      "handle": ".tdl_move",
      "placeholder": "sortable_custom_placeholder",
      "forcePlaceholderSize": true,
      "revert": "true",
    });

    $(todo_lists_root).on('sortupdate',(event_obj,sort_obj) => {

      let run = '';
      let el_class = '';
      let tdl_id = null;
      if ($(event_obj.target).is('.todo_lists_root')) {
        run = 'todolist_sort_run';
        el_class = '.to_do_list';
      } else if ($(event_obj.target).is('.tdl_tasks_root')) {
        run = 'tasklist_sort_run';
        el_class = '.task_element';
        tdl_id = $(event_obj.target).parents('.to_do_list').data('attrs')['id'];
      }

      let sorted_arr = $.makeArray($(event_obj.target).children(el_class))
        .map(el_obj => $(el_obj).data('attrs')['id']);

      let req_data = {'sorted_arr': sorted_arr};
      if (tdl_id) req_data['to_do_list_id'] = tdl_id;

      $.post('?run='+run,JSON.stringify(req_data))
        .done(function(from_server) {
            if (from_server['status'] != 'ok') {
              api_problem_handler(from_server);
              $(event_obj.target).sortable("cancel");
            }
        })
        .fail(() => {
          api_problem_handler();
          $(event_obj.target).sortable("cancel");
        });
    });

    $(todo_lists_root).on('click','.tdl_name',event_obj => {
      let tdl_obj = $(event_obj.target).parents('.to_do_list');
      let tdl_data = $(tdl_obj).data();

      if (!tdl_data['open_status'] || (tdl_data['open_status'] == 'closed')) {
        tdl_data['open_status'] = 'wait';
        show_task_list(tdl_data['attrs']['id']);
      }
      else if (tdl_data['open_status'] == 'opened') {
        tdl_data['open_status'] = 'wait';
        $(tdl_obj).children('.add_task_place, .tdl_tasks_root').hide();

        let del_selections = $(tdl_obj).find('.taskel_del_selector:checked');
        if ($(del_selections).length > 0) {
          $(del_selections).prop("checked",false);
          change_taskel_del_selector_funct();
          page_alert('The bulk delete marking where deleted from tasks in the collapsed TODO List');
        }
        tdl_data['open_status'] = 'closed';
      }
      else {//tdl_data['open_status'] == 'wait'
        //Ignore
      }
    });

    $(todo_lists_root).on('click','.tdl_edit',event_obj => {
      let tdl_obj = $(event_obj.target).parents('.to_do_list');
      let tdl_data = $(tdl_obj).data('attrs');

      let form_input = $('.edit_tdl_form_input');
      let dialog_obj = $('.edit_tdl_form').dialog({
          'width': 500, 'height': 200, 'modal': true,
          'open': () => {
            $(form_input).val(tdl_data['name']);
          },
          'buttons': {
            'Save': dial_event_obj => {
              let input_val = $.trim($(form_input).val());
              if (input_val == '') {
                $(form_input).tooltip("option","disabled",false).tooltip('open');
                return false;
              }

              $.post('?run=todolist_edit_run',JSON.stringify({'to_do_list_id': tdl_data['id'],'tdl_name': input_val}))
                .done(function(from_server) {
                    if (from_server['status'] == 'ok') {
                      tdl_data['name'] = input_val;
                      $(event_obj.target).siblings('.tdl_name').text(input_val);

                      $(dialog_obj).dialog('close');
                    }
                    else {
                      api_problem_handler(from_server);
                    }
                })
                .fail(() => api_problem_handler());
            },
            'Cancel': () => $(dialog_obj).dialog('close'),
          },
          'close': () => {
            $(form_input).tooltip("option","disabled",true);
            $('.alert').hide();
          },
      });
    });

    $(todo_lists_root).on('click','.tdl_delete',event_obj => {
      let tdl_obj = $(event_obj.target).parents('.to_do_list');
      let tdl_data = $(tdl_obj).data('attrs');

      let dialog_obj = $('.del_tdl_confirm').dialog({
        'width': 600, 'height': 250, 'modal': true,
        'open': () => {
          $('.del_tdl_name').text('"'+tdl_data['name']+'"');
        },
        'buttons': {
          'Delete': () => {
            $.post('?run=todolist_delete_run',JSON.stringify({'to_do_list_id': tdl_data['id']}))
              .done(function(from_server) {
                  if (from_server['status'] == 'ok') {
                    $(tdl_obj).remove();

                    change_taskel_del_selector_funct();

                    if ($(todo_lists_root).children('.to_do_list').length == 0) {
                      $('.tdl_load')
                        .html('You have no TODO Lists<br>Click the "Add TODO List" button to create a new TODO List')
                        .show();
                    }

                    $(dialog_obj).dialog('close');
                  }
                  else {
                    api_problem_handler(from_server);
                  }
              })
              .fail(() => api_problem_handler());
          },
          'Cancel': () => $(dialog_obj).dialog('close'),
        },
        'close': () => $('.alert').hide(),
      });
    });

    let ctrl_pressed = 0;
    $(document).keydown(event_obj => {
      if (event_obj.key == 'Control'){
        ctrl_pressed++;
        if (ctrl_pressed == 1){
          $('.taskel_content_div:hover').addClass('taskel_content_div_remove_hover');

          $(document).keyup(event_obj => {
            if (event_obj.key == 'Control'){
              if (ctrl_pressed > 0) ctrl_pressed--;
              if (ctrl_pressed == 0) {
                $(document).off('keyup');
                $('.taskel_content_div_remove_hover').removeClass('taskel_content_div_remove_hover');
              }
            }
          });
        }
      }
    });

    $(document).on('mouseenter','html',event_obj => {
      if (ctrl_pressed && !event_obj.originalEvent.getModifierState('Control')){
        ctrl_pressed = 0;
      }
    });

    $(todo_lists_root).on('mouseover','.task_element',event_obj => {
      $(event_obj.currentTarget).find('.taskel_manage').css('visibility','visible');
      if (ctrl_pressed) {
        $(event_obj.currentTarget).find('.taskel_content_div').addClass('taskel_content_div_remove_hover');
      }
    });

    $(todo_lists_root).on('mouseleave','.task_element',event_obj => {
      $(event_obj.currentTarget).find('.taskel_manage').css('visibility','hidden');
      if (ctrl_pressed) {
        $(event_obj.currentTarget).find('.taskel_content_div').removeClass('taskel_content_div_remove_hover');
      }
    });

    $(todo_lists_root).on('click','.taskel_content_div_remove_hover',event_obj => {
      if ($(event_obj.target).is('.taskel_content_div')) {
        $(event_obj.target)
          .toggleClass('taskel_content_div_remove_selected')
          .find('.taskel_del_selector').trigger('click');
      }
    });

    $(todo_lists_root).on('click','.add_task_btn',event_obj => {
      let tdl_obj = $(event_obj.target).parents('.to_do_list')
      let tdl_obj_data = $(tdl_obj).data('attrs');
      let add_task_obj = $(tdl_obj).find('.add_task_field');
      let add_task_val = $.trim($(add_task_obj).val());

      let adtsk_form_input = $('.adtsk_form_input');

      let dialog_obj = $('.adtsk_form').dialog({
          'width': 'auto', 'height': 'auto', 'modal': true,
          'open': () => {
            $('.adtsk_tdl_name').text(tdl_obj_data['name']);

            $(adtsk_form_input).val(add_task_val);
            textarea_auto_resize(adtsk_form_input[0]);

            $('.adtsk_do_before_allow').prop("checked", false);

            let now_datetime = get_datetime_arr();
            $('.adtsk_do_before_date').val("").prop({"disabled":true,"min":now_datetime[0]});
            $('.adtsk_do_before_time').val("").prop("disabled",true);
          },
          'buttons': {
            'Create task': () => {
              let values = {};
              let every_ok = $.makeArray($('.adtsk_form_input, .adtsk_do_before_date:enabled, .adtsk_do_before_time:enabled'))
                .every(el_obj => {
                  let input_val = $.trim($(el_obj).val());
                  if (input_val == '') {
                    $(el_obj).tooltip("option","disabled",false).tooltip('open');
                    return false;
                  }
                  values[$(el_obj).attr('name')] = input_val;
                  return true;
                });

                if (!every_ok) return;

                $.post('?run=tasklist_add_run',
                    JSON.stringify({
                      'to_do_list_id':tdl_obj_data['id'],
                      'content':values['content'],
                      'do_before': !values['date'] ? null : values['date']+' '+values['time']+get_timezone(),
                    }))
                  .done(function(from_server) {
                      if (from_server['status'] == 'ok') {

                        tasklist_render(from_server['data'],tdl_obj_data['id']);

                        $(dialog_obj).dialog('close');
                        $(add_task_obj).val("");
                        textarea_auto_resize(add_task_obj[0],'resize_now');
                      }
                      else {
                        api_problem_handler(from_server);
                      }
                  })
                  .fail(() => api_problem_handler());
            },
            'Cancel': () => $(dialog_obj).dialog('close'),
          },
          'close': () => {
            $('.adtsk_form_input, .adtsk_do_before_date, .adtsk_do_before_time').tooltip("option","disabled",true);
            $('.alert').hide();
          },
      });
    });

    $(todo_lists_root).on('change','.taskel_done_selector', event_obj => {
      $(event_obj.target).prop("disabled",true);
      let taskel_data = $(event_obj.target).parents('.task_element').data('attrs');

      $.post('?run=tasklist_edit_status_run',
          JSON.stringify({
            'task_id': taskel_data['id'],
            'done': $(event_obj.target).prop("checked"),
          }))
        .done(function(from_server) {
            if (from_server['status'] == 'ok') {
              taskel_data['done'] = $(event_obj.target).prop("checked") ? 1 : 0;
              tasklist_render({'task_list':[taskel_data]},null,'edit_mode');
            }
            else {
              $(event_obj.target).prop("checked",!$(event_obj.target).prop("checked"));
              api_problem_handler(from_server);
            }
        })
        .fail(() => {
          $(event_obj.target).prop("checked",!$(event_obj.target).prop("checked"));
          api_problem_handler();
        })
        .always(() => $(event_obj.target).prop("disabled",false));
    });

    let change_taskel_del_selector_funct = () => {
      let arr_length = $('.taskel_del_selector:checked').length;
      if (arr_length == 1) {
        $('.taskel_selected_del_count').text(arr_length);
        $('.taskel_selected_del').show();
      } else if (arr_length > 1) {
        $('.taskel_selected_del_count').text(arr_length);
      } else {
        $('.taskel_selected_del').hide();
      }
    };

    $(todo_lists_root).on('change','.taskel_del_selector',change_taskel_del_selector_funct);

    $(todo_lists_root).on('click','.taskel_edit',event_obj => {
      let tdl_obj_data = $(event_obj.target).parents('.to_do_list').data('attrs');
      let taskel_obj = $(event_obj.target).parents('.task_element');
      let taskel_data = $(taskel_obj).data('attrs');

      let edtsk_form_input  = $('.edtsk_form_input');

      let dialog_obj = $('.edtsk_form').dialog({
          'width': 'auto', 'height': 'auto', 'modal': true,
          'open': () => {
            $('.edtsk_tdl_name').text(tdl_obj_data['name']);

            $(edtsk_form_input).val(taskel_data['content']);
            textarea_auto_resize(edtsk_form_input[0]);

            let now_datetime = get_datetime_arr();
            if (taskel_data['do_before']){
              let dttme = get_datetime_arr(taskel_data['do_before']);

              $('.edtsk_do_before_allow').prop("checked", true);
              $('.edtsk_do_before_date').val(dttme[0]).prop({"disabled":false,"min":now_datetime[0]});
              $('.edtsk_do_before_time').val(dttme[1]).prop("disabled",false);
            } else {
              $('.edtsk_do_before_allow').prop("checked", false);
              $('.edtsk_do_before_date').val("").prop({"disabled":true,"min":now_datetime[0]});
              $('.edtsk_do_before_time').val("").prop("disabled",true);
            }
          },
          'buttons': {
            'Edit task': () => {
              let values = {};
              let every_ok = $.makeArray($('.edtsk_form_input, .edtsk_do_before_date:enabled, .edtsk_do_before_time:enabled'))
                .every(el_obj => {
                  let input_val = $.trim($(el_obj).val());
                  if (input_val == '') {
                    $(el_obj).tooltip("option","disabled",false).tooltip('open');
                    return false;
                  }
                  values[$(el_obj).attr('name')] = input_val;
                  return true;
                });

                if (!every_ok) return;

                $.post('?run=tasklist_edit_run',
                    JSON.stringify({
                      'task_id': taskel_data['id'],
                      'content': values['content'],
                      'do_before': !values['date'] ? null : values['date']+' '+values['time']+get_timezone(),
                    }))
                  .done(function(from_server) {
                      if (from_server['status'] == 'ok') {

                        tasklist_render(from_server['data'],tdl_obj_data['id'],'edit_mode');

                        $(dialog_obj).dialog('close');
                      }
                      else {
                        api_problem_handler(from_server);
                      }
                  })
                  .fail(() => api_problem_handler());
            },
            'Cancel': () => $(dialog_obj).dialog('close'),
          },
          'close': () => {
            $('.edtsk_form_input, .edtsk_do_before_date, .edtsk_do_before_time').tooltip("option","disabled",true);
            $('.alert').hide();
          }
      });
    });

    $('.adtsk_do_before_allow, .edtsk_do_before_allow').on('change',event_obj => {
      $(event_obj.target).siblings('input')
        .prop("disabled",!$(event_obj.target).is(':checked'));

        if ($(event_obj.target).is(':checked')) {
          $(event_obj.target).siblings("input[type='date']").triggerHandler('change');
        }
    });

    $('.adtsk_do_before_date, .edtsk_do_before_date').on('change',event_obj => {
      if ($(event_obj.target).val() == ''){
          $(event_obj.target).siblings("input[type='time']").prop("disabled",true);
      }
      else {
        let time_obj = $(event_obj.target).siblings("input[type='time']").prop("disabled",false);
        if ($(time_obj).val() == '') $(time_obj).val('00:00');
      }
    });

    $(todo_lists_root).on('click','.taskel_delete',event_obj => {
      let taskel_obj = $(event_obj.target).parents('.task_element');
      let tdl_obj = $(taskel_obj).parents('.to_do_list');

      let taskel_data = $(taskel_obj).data('attrs');

      let tdl_name = $(tdl_obj).data('attrs')['name'];
      if (tdl_name.length > 50) {tdl_name = tdl_name.slice(0,50)+'…';}

      let content_str = taskel_data['content'].length < 60 ?
          taskel_data['content'] :
          taskel_data['content'].slice(0,60)+'…';

      let dialog_obj = $('.del_task_confirm').dialog({
        'width': 600, 'height': 270, 'modal': true,
        'open': () => {
          $('.del_task_tdl_name').text('"'+tdl_name+'"');
          $('.del_task_content').text('"'+content_str+'"');
        },
        'buttons': {
          'Delete': dial_event_obj => {
            $.post('?run=tasklist_delete_run',JSON.stringify({"task_del_arr":[taskel_data['id']]}))
              .done(function(from_server) {
                  if (from_server['status'] == 'ok') {
                    $(taskel_obj).remove();
                    change_taskel_del_selector_funct();

                    if($(tdl_obj).find('.task_element').length == 0){
                      $(tdl_obj).find('.taskel_load').text('The TODO List is empty').show();
                    }
                    $(dialog_obj).dialog('close');

                    if (parseInt(from_server['data']['del_count']) == 0) {
                      page_alert('This task not found in the database, but it has deleted from the page<br>Please reopen the TODO List for to get the actual list of tasks');
                    }
                  }
                  else {
                    api_problem_handler(from_server);
                  }
              })
              .fail(() => api_problem_handler());
          },
          'Cancel': () => $(dialog_obj).dialog('close'),
        },
      });
    });

    function show_todolist (){
      $('.tdl_load').text('Loading...');

      $.post('?run=todolists_get')
        .done(function(from_server) {
            if (from_server['status'] == 'ok') {
              if (from_server['data'].length > 0){
                todolist_render(from_server['data']);
                show_task_list($('.to_do_list').first().data('attrs')['id']);
              }
              else {
                $('.tdl_load').html('You have no TODO Lists<br>Click the "Add TODO List" button to create a new TODO List');
              }
            }
            else {
              api_problem_handler(from_server);
            }
        })
        .fail(() => api_problem_handler());
    }

    function todolist_render(data){
      let template = $(templates_storage).children('.to_do_list').clone();

      let list_array = data.map(data_el => {
        let tdl_el = $(template).clone();
        $(tdl_el)
          .addClass('to_do_list__'+data_el['id'])
          .data('attrs',data_el);
        $(tdl_el).find('.tdl_name').text(data_el['name']);
        $(tdl_el).find('.add_task_btn').button();

        return tdl_el;
      });

      $('.tdl_load').hide();
      $(todo_lists_root).append(list_array);

      list_array.forEach(tdl_el => {
        textarea_auto_resize($(tdl_el).find('.add_task_field')[0]);
      });
    }

    function show_task_list(tdl_id){
      let tdl_el = $('.to_do_list__'+tdl_id);

      $(tdl_el).children('.add_task_place').css("display","flex");

      let add_task_field = $(tdl_el).find('.add_task_field');
      if ($(add_task_field).val() != '')
      {
        $(add_task_field).val($.trim($(add_task_field).val()));
        textarea_auto_resize($(add_task_field)[0],'resize_now');
      }

      $(tdl_el).find('.task_element').remove();
      $(tdl_el).children('.tdl_tasks_root')
        .show()
        .children('.taskel_load').show().text('Loading...');

      $.post('?run=tasklist_get',JSON.stringify({'to_do_list_id': tdl_id}))
        .done(function(from_server) {
            if (from_server['status'] == 'ok') {
              tasklist_render(from_server['data'],tdl_id);
            }
            else {
              api_problem_handler(from_server);
              $(tdl_el).data('open_status') = 'closed';
            }
        })
        .fail(() => {
            api_problem_handler();
            $(tdl_el).data('open_status') = 'closed';
        });
    }

    function tasklist_render(data,tdl_id,edit_mode){
      if (data['task_list'].length > 0) {
        let template = edit_mode ? null : $(templates_storage).children('.task_element').clone();

        let render_funct = data_el => {
          let taskel_el;

          if (edit_mode) {
            taskel_el = $('.task_element__'+data_el['id'])
              .data('attrs',data_el);
          }
          else {
            taskel_el = $(template).clone();
            $(taskel_el)
              .addClass('task_element__'+data_el['id'])
              .data('attrs',data_el);
          }

          if (data_el['done'] == 1){
            $(taskel_el)
              .children('.taskel_selector_div').addClass('taskel_is_done')
              .children('.taskel_done_selector').prop("checked",true);
          } else {
            $(taskel_el).children('.taskel_selector_div').removeClass('taskel_is_done')
          }

          $(taskel_el).find('.taskel_content').text(data_el['content']);

          if (!edit_mode) $(taskel_el).find('.taskel_created_val').text(get_datetime_arr(data_el['created'])[2]);
          if (data_el['do_before']) {
            let db_div_css = {"display":"block","color":""};
            let warn_color = 'unset';
            let font_weight = 'normal';

            if (data_el['done'] == 0) {
              warn_color =
                  (!data_el['do_before_expire'] || (data_el['do_before_expire'] == 'no')) ? 'unset' :
                      data_el['do_before_expire'] == 'soon' ? 'darkorange' : 'red';

              font_weight = (warn_color == 'unset') ? 'normal' : 'bold';
            } else {
              db_div_css['color'] = 'grey';
            }

            $(taskel_el).find('.taskel_do_before_div').css(db_div_css)
              .children('.taskel_do_before_val')
                .css({"color":warn_color,"font-weight":font_weight})
                .text(get_datetime_arr(data_el['do_before'])[2]);
          }
          else {
            $(taskel_el).find('.taskel_do_before_div').css("display","none");
          }

          return taskel_el;
        };

        if (edit_mode) {
          render_funct(data['task_list'][0]);
        } else {
          let list_array = data['task_list'].map(render_funct);

          let tdl_root = $('.to_do_list__'+tdl_id+' > .tdl_tasks_root');
          let count_before = $(tdl_root).children('.task_element').length;
          if (count_before == 0) {
            $(tdl_root).children('.taskel_load').hide();
          }

          $(tdl_root).append(list_array);

          if (count_before == 0) {
            $(tdl_root).sortable({
              "axis": "y",
              "items": ".task_element",
              "handle": ".taskel_move",
              "placeholder": "sortable_custom_placeholder",
              "forcePlaceholderSize": true,
              "revert": "true",
            });
          }
        }
      }
      else {
        $('.to_do_list__'+tdl_id+' > .tdl_tasks_root').children('.taskel_load').text('The TODO List is empty');
      }
      if (!edit_mode) $('.to_do_list__'+tdl_id).data('open_status','opened');
    }

    show_todolist();
});
