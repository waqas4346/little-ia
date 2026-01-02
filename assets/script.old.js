

// header location
$("#ia_globe").click(function(){
  $("#ia_globe-dropdown").toggle();
});

$("#ia_globe-dropdown .ia_globe-dropdown-inner").click(function(){
  $("#ia_globe-dropdown").toggle();
});

jQuery("#sca-qv-addcart-msg").attr("style","position:relative !important;margin-top: 20px");

$("#ia_category-label").click(function(){
  $("#ia_category-collection").slideToggle();
});

$("ul#ia_globe-dropdown-ul").on("click", ".init", function() {
  $(this).closest("ul").children('li:not(.init)').toggle();
});

$("ul#ia_globe-dropdown-ul").on("click", ".init", function() {
  $(this).closest("ul").children('li:not(.init)').toggleClass();
});

var allOptions = $("ul#ia_globe-dropdown-ul").children('li:not(.init)');
$("ul#ia_globe-dropdown-ul").on("click", "li:not(.init)", function() {
  allOptions.removeClass('selected');
  $(this).addClass('selected');
  $("ul#ia_globe-dropdown-ul").children('.init').html($(this).html());
  allOptions.toggle();
});


$("#ia_globe-dropdown-main ul#ia_globe-dropdown-ul-sm").on("click", ".init", function() {
  $(this).closest("#ia_globe-dropdown-main  ul#ia_globe-dropdown-ul-sm").children('li:not(.init)').toggle();
});

var allOptions = $("#ia_globe-dropdown-main ul#ia_globe-dropdown-ul-sm").children('li:not(.init)');
$("#ia_globe-dropdown-main ul#ia_globe-dropdown-ul-sm").on("click", "li:not(.init)", function() {
  allOptions.removeClass('selected');
  $(this).addClass('selected');
  $("#ia_globe-dropdown-main ul#ia_globe-dropdown-ul-sm").children('.init').html($(this).html());
  allOptions.toggle();
});

// blog post mobile load more
$( document ).ready(function (e) {
  $(".izaak_blog-mobileView ul.grid--blog .grid__item").slice(0, 4).show();
  $("#load-more").on('click', function (e) {
    e.preventDefault();
    $(".izaak_blog-mobileView ul.grid--blog .grid__item:hidden").slice(0, 2).slideDown();
    if ($(".izaak_blog-mobileView ul.grid--blog .grid__item:hidden").length == 0) {
      $("#load-more").fadeOut('slow');
    }
    $('html,body').animate({
      scrollTop: $(this).offset().top
    }, 1500);
  });
});


$(document).ready(function() {

  $("#ia_globe-dropdown-ul").click(function(event){
    event.stopPropagation();
  });

});

$(document).ready(function() {
  if(window.location.href.match('collections/all/little-ia')){
    $("body").addClass("little-ia");
  }
});

$(window).load(function() {
  // The slider being synced must be initialized first
  $('#carousel').flexslider({
    animation: "slide",
    controlNav: false,
    animationLoop: false,
    slideshow: false,
    itemWidth: 90,
    itemMargin: 0,
    asNavFor: '#slider'
  });

  $('#slider').flexslider({
    animation: "slide",
    controlNav: false,
    animationLoop: false,
    slideshow: false,
    sync: "#carousel"
  });
});

// gallery slide

jQuery('#ia_gallery-carousel').slick({

  slidesToShow: 5,
  autoplay: true,
  autoplaySpeed: 2000,
  arrows: true,
  responsive: [
    {
      breakpoint: 1200,
      settings: {
        slidesToShow: 4
      }
    },
    {
      breakpoint: 992,
      settings: {
        slidesToShow: 3
      }
    },
    {
      breakpoint: 768,
      settings: {
        slidesToShow: 2
      }
    },
    {
      breakpoint: 480,
      settings: {
        slidesToShow: 1
      }
    }
  ]
});
jQuery(document).ready(function(){  
  var button = $('.product-form__cart-submit').attr('aria-label');
  if(button == 'Sold out'){
    $('.common-class').css('display','none');
  }
  else{
    $('.common-class').css('display','block');
  }
  jQuery('.single-option-selector').on('change',function(){
    var qty = $(".single-option-selector option:selected").attr('data-id');
    var button = $('.product-form__cart-submit').attr('aria-label');
    if(button == 'Sold out'){
      $('.common-class').css('display','none');
    }
    else{
      $('.common-class').css('display','block');
      $('.common-class').removeClass('hide');
      if( qty <  3){

        $('.common-class').html('Low in stock');

      } else {
        $('.common-class').css('display','none');
      }
    }
  });

});

//start code for homepage slider for desktop
jQuery(document).ready(function(){
  jQuery('#search_product').on('click',function(e){
    event.preventDefault();
    var select_gender = jQuery( "#select_gender option:selected" ).val();
    var select_age    = jQuery( "#select_age option:selected" ).val();
    if( select_gender == '0' && select_age == '0' ){
      $('#select_gender').css('border-color','red');
      $('#select_age').css('border-color','red');
      alert('Select the required field');
    }
    else if( select_age == '0' && select_gender != '0' ){
      alert('Select the Age first');
      $('#select_age').css('border-color','red');
      $('#select_gender').removeAttr('style');
    }
    else if( select_age != '0' && select_gender == '0' ){
      alert('Select the Gender first');
      $('#select_gender').css('border-color','red');
      $('#select_age').removeAttr('style');
    }
    else if( select_gender != '0' && select_age == 'all_ages' ){
      $('#select_gender').removeAttr('style');
      $('#select_age').removeAttr('style');
    }
    else if( select_gender != '0' && select_age != '0' ){
      $('#select_gender').removeAttr('style');
      $('#select_age').removeAttr('style');
      window.location.replace("https://www.little-ia.com/collections/"+select_gender+'/'+select_age);
    }
  });
});
//end code for homepage slider
//start code for homepage slider for mobile
jQuery(document).ready(function(){
  jQuery('#search_product_1').on('click',function(e){
    event.preventDefault();
    var select_gender = jQuery( "#select_gender_1 option:selected" ).val();
    var select_age    = jQuery( "#select_age_1 option:selected" ).val();
    if( select_gender == '0' && select_age == '0' ){
      $('#select_gender_1').css('border-color','red');
      $('#select_age_1').css('border-color','red');
      alert('Select the required field');
    }
    else if( select_age == '0' && select_gender != '0' ){
      alert('Select the Age first');
      $('#select_age_1').css('border-color','red');
      $('#select_gender_1').removeAttr('style');
    }
    else if( select_age != '0' && select_gender == '0' ){
      $('#select_gender_1').css('border-color','red');
      $('#select_age_1').removeAttr('style');
    }
    else if( select_gender != '0' && select_age == 'all_ages' ){
      $('#select_gender_1').removeAttr('style');
      $('#select_age_1').removeAttr('style');
      window.location.replace("https://www.little-ia.com/collections/"+select_gender);
    }
    else if( select_gender != '0' && select_age != '0' ){
      $('#select_gender_1').removeAttr('style');
      $('#select_age_1').removeAttr('style');
      window.location.replace("https://www.little-ia.com/collections/"+select_gender+'/'+select_age);
    }
  });
});
//end code for homepage slider

const accordions = document.querySelectorAll(".accordion");
for (const accordion of accordions) {
  const panels = accordion.querySelectorAll(".accordion-panel");
  for (const panel of panels) {
    const head = panel.querySelector(".accordion-header");
    head.addEventListener("click", () => {
                          for (const otherPanel of panels) {
      if (otherPanel !== panel) {
        otherPanel.classList.remove("accordion-expanded");
      }
    }
    panel.classList.toggle("accordion-expanded");
  });
}
}

// product slider
var galleryThumbs = new Swiper('.gallery-thumbs', {
  spaceBetween: 0,
  slidesPerView: 1,
  freeMode: true,
  mousewheel: false,
  keyboard: {
    enabled: false,
  },
  effect: 'fade',
  watchSlidesVisibility: true,
  watchSlidesProgress: true,
});
var galleryTop = new Swiper('.gallery-top', {
  spaceBetween: 0,
  effect: 'fade',
  mousewheel: false,
  keyboard: {
    enabled: false,
  },
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  },
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
  },
  thumbs: {
    swiper: galleryThumbs
  }
});


// Terms & Condition js


$(document).on('click','.jumplink-blog-box__list > li > a, .jumplink-blog-box__list > li > ul > li > a', function(){

  var id = $(this).attr('id');

  var href = $(this).attr("href");

  var position = $(href).offset().top - 145;

  jQuery("body, html").animate({
    scrollTop: position
  } /* speed */ );   

});

jQuery(document).ready(function() {                                                                          
// CD  jQuery(tocList).empty();	    
  var prevH2List = jQuery();
  var prevH2Item = jQuery();
  var index = 0;                                                                    
  jQuery(".ia_termsCondition-rte h2, .ia_termsCondition-rte h3").each(function() { 
    //insert an anchor to jump to, from the TOC link.            
    var anchor = "<a id='title_" + index + "'></a>";
    jQuery(this).before(anchor);
    var $class = ''; 

    if(jQuery(this).is("h2")){
      $class = 'h2';
    }
    if(jQuery(this).is("h3")){
      $class = 'h3';
    }
    if(jQuery(this).is("h4")){
      $class = 'h4';
    }
    if(jQuery(this).is("h5")){
      $class = 'h5';
    }
    if(jQuery(this).is("h6")){
      $class = 'h6';
    }

    var li = "<li class='jumplink-blog-box__item " + $class + "'  ><a id='head_" + index + "' href='#title_" + index + "' href='#" + index + "'>" + jQuery(this).text() + "</a></li>";
    if( jQuery(this).is("h2,h3,h4,h5,h6") ){            
      prevH2Item = jQuery(li);
      prevH2Item.append(prevH2List);      
      prevH2Item.appendTo("#tocList");
    } else {

      prevH2List.append(li);
    }
    index++;
  });
});  

$(".col-sidebar").stick_in_parent({
  offset_top: 195
});

// filter js
$("#collection-filterSpan").click(function(){
  $("#collectionFilter").toggleClass('open');
  $("#collection-filterSpan").toggleClass('open');
});

$("#sortBy-filterSpan").click(function(){
  $("#SortBy").toggleClass('open');
  $("#sortBy-filterSpan").toggleClass('open');
});

// subscribe js
$(window).load(function() {
  checkCookie();
});

$(".fd-modal__close").click(function(){
  $(".izaak_subscribe-Popup").hide();
});


function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + 1 * 3600 * 1000);
  var expires = "expires="+d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
  var name = cname + "=";
  var ca = document.cookie.split(';');
  for(var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

function checkCookie() {
  var user = getCookie("little");
  if (user == "") {
    setTimeout(function() {
      $(".izaak_subscribe-Popup").show('fadeIn', {}, 500)
    }, 2000);
    setCookie("little", "ok", 365);    
  } 
}

// collection gallery slider js
// var swiper = new Swiper('#collection-gallery-slider', {
//   slidesPerView: 5,
//   spaceBetween: 30,
//   navigation: {
//     nextEl: '.swiper-button-next',
//     prevEl: '.swiper-button-prev',
//   },
//   grabCursor: false,
//   breakpoints: {
//     0: {
//       slidesPerView: 'auto',
//       spaceBetween: 30,
//     },
//     640: {
//       slidesPerView: 'auto',
//       spaceBetween: 0,
//     },
//     768: {
//       slidesPerView: 3,
//     },
//     992: {
//       slidesPerView: 4,
//     },
//     1200: {
//       slidesPerView: 5,
//     },
//   }
// });

$('#collection-gallery-slider').slick({
  dots: false,
  arrows: false,
  infinite: false,
  speed: 300,
  slidesToShow: 5,
  slidesToScroll: 1,
  responsive: [
    {
      breakpoint: 1200,
      settings: {
        slidesToShow: 4,
        arrows: true,
        slidesToScroll: 1
      }
    },
    {
      breakpoint: 992,
      settings: {
        slidesToShow: 3,
        arrows: true,
        slidesToScroll: 1
      }
    },
    {
      breakpoint: 768,
      settings: {
        slidesToShow: 2,
        arrows: true,
        centerPadding: '90px',
        centerMode: true,
  		infinite: true
      }
    },
    {
      breakpoint: 700,
      settings: {
        slidesToShow: 2,
        arrows: true,
        centerPadding: '70px',
        centerMode: true,
  		infinite: true
      }
    },
    {
      breakpoint: 640,
      settings: {
        slidesToShow: 1,
        arrows: true,
        slidesToScroll: 1,
        centerPadding: '135px',
        centerMode: true,
  		infinite: true
      }
    },
    {
      breakpoint: 540,
      settings: {
        slidesToShow: 1,
        arrows: true,
        slidesToScroll: 2,
        centerPadding: '105px',
        centerMode: true,
  		infinite: true
      }
    },
    {
      breakpoint: 480,
      settings: {
        slidesToShow: 1,
        arrows: true,
        slidesToScroll: 1,
        centerPadding: '75px',
        centerMode: true,
  		infinite: true
      }
    },
    {
      breakpoint: 400,
      settings: {
        slidesToShow: 1,
        arrows: true,
        slidesToScroll: 1,
        centerPadding: '45px',
        centerMode: true,
  		infinite: true
      }
    },
    {
      breakpoint: 360,
      settings: {
        slidesToShow: 1,
        arrows: true,
        slidesToScroll: 1,
        centerPadding: '35px',
        centerMode: true,
  		infinite: true
      }
    }
  ]
});


// our mission charity js
var swiper = new Swiper('#izaak_charity-highlight', {
  slidesPerView: 3,
  spaceBetween: 30,
  // init: false,
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
  },
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  },
  breakpoints: {
    0: {
      slidesPerView: 1,
      spaceBetween: 0,
    },
    768: {
      slidesPerView: 2,
    },
    992: {
      slidesPerView: 3,
    },
    1200: {
      slidesPerView: 3,
      spaceBetween: 30,
    },
  }
});


// related blog js
var swiper = new Swiper('#izaak_related-blog', {
  slidesPerView: 3,
  spaceBetween: 30,
  // init: false,
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
  },
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  },
  breakpoints: {
    0: {
      slidesPerView: 1,
      spaceBetween: 0,
    },
    768: {
      slidesPerView: 2,
    },
    992: {
      slidesPerView: 3,
    },
    1200: {
      slidesPerView: 3,
      spaceBetween: 30,
    },
  }
});


// related blog js
var swiper = new Swiper('#izaak_momsveration-blog', {
  slidesPerView: 3,
  spaceBetween: 30,
  // init: false,
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
  },
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  },
  breakpoints: {
    0: {
      slidesPerView: 1,
      spaceBetween: 0,
    },
    768: {
      slidesPerView: 2,
    },
    992: {
      slidesPerView: 3,
    },
    1200: {
      slidesPerView: 4,
      spaceBetween: 20,
    },
  }
});

// footer subscribe js
$("#ia_footer-subscribeBtn").click(function(){
  $("#ia_footer-subscribeModal").addClass("popup-open");
});

$(".ia_footerPopup-close").click(function(){
  $("#ia_footer-subscribeModal").removeClass("popup-open");
});

// blog tag js   
// CD
var swiper = new Swiper('#blog-tags-slider', {
  slidesPerView: 'auto',
  spaceBetween: 18,
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
  },
});

$('label[for="Personalisation"]').click(function(){
  var input = $(this).find('input').prop('checked');
  if(input){
   $('.Personalise-text_confirm.tab_list').slideDown();
  } else {
   $('.Personalise-text_confirm.tab_list').slideUp();
  }
})


// $('.selector-wrapper .main-inpt label').click(function(){
//     $(this).parent().find('input').trigger('click')
// })

// $('.personalise_box-tab p.tab_btn span').click(function(){
//     $(this).parent().find('input').prop("checked", true).change();
//     $(this).parent().find('input').prop("checked", false).change();
//  	$('#tab_content1').toggle();
//     $('.check-boxes').toggle();
// })
$("#shopify-section-header ul#SiteNav > li .site-nav__child-link--parent span:contains('Personalised')").html(function(_, html) {
   return html.split('Personalised').join("<span class='breakword'>Personalised</span>");
});
