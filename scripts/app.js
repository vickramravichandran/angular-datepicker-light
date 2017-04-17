(function () {
    'use strict';

    angular
        .module('mainApp', ['datepickerLightModule', 'ngSanitize'])
        .controller('MainCtrl', function($document){
            // since we are loading example html using ng-include
            // need to call Prism.highlightElement after the content is loaded
            this.prism = function() {
                $('code.language-markup:not([prismjs-done]), code.language-javascript:not([prismjs-done])')
                .each(function(){
                    var $this = $(this);
                    Prism.highlightElement($this[0]);
                    $this.attr('prismjs-done', true);
                });
            };
        })
        .controller('OnFocusCtrl', OnFocusCtrl)
        .controller('InlineCtrl', InlineCtrl)
        .controller('InlineDisabledDatesCtrl', InlineDisabledDatesCtrl)
        .controller('InlineOtherMonthDatesCtrl', InlineOtherMonthDatesCtrl)
        .controller('InlineCustomWeekStartCtrl', InlineCustomWeekStartCtrl)
        .controller('InlineDivTargetCtrl', InlineDivTargetCtrl)
        .controller('PluginOptionsCtrl', PluginOptionsCtrl);

    // on focus
    function OnFocusCtrl() {
        var vm = this;
        
        vm.date = moment(new Date()).format('MM/DD/YYYY');
        vm.datepickerOptions = {
            altTarget: $("#calendarIcon")
        };
    }

    // inline
    function InlineCtrl() {
        var vm = this;

        vm.date = new Date();
        vm.datepickerOptions = {
            inline: true,
            containerCssClass: "datepicker-container-inline"
        };
    }

    // inline, disabled dates, tooltip
    function InlineDisabledDatesCtrl() {
        var vm = this;

        vm.date = new Date();
        vm.datepickerOptions = {
            inline: true,
            containerCssClass: "datepicker-container-inline",
            renderDate: function (e) {
                return {
                    enabled: e.date.getDate() > 10
                }
            }
        };
    }

    // inline, other month dates
    function InlineOtherMonthDatesCtrl() {
        var vm = this;

        vm.date = new Date();
        vm.datepickerOptions = {
            inline: true,
            showOtherMonthDates: true,
            containerCssClass: "datepicker-container-inline"
        };
    }

    // inline, custom week start
    function InlineCustomWeekStartCtrl() {
        var vm = this;

        vm.date = new Date();
        vm.datepickerOptions = {
            inline: true,
            firstDayOfWeek: 3, // week starts on Wednesday
            containerCssClass: "datepicker-container-inline"
        };
    }

    function InlineDivTargetCtrl() {
        var vm = this;

        vm.date = new Date();
        vm.datepickerOptions = {
            inline: true,
            containerCssClass: "datepicker-container-inline",
            dateFormat: 'MMM Do YYYY'
        };
    }

    PluginOptionsCtrl.$inject = ['datepickerLightService'];
    function PluginOptionsCtrl(datepickerLightService) {
        this.options = datepickerLightService.getDefaultOptionsDoc();
    }

})();
