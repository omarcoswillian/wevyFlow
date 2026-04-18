<?php
namespace WevyFlow\Widgets;
use Elementor\Widget_Base;
use Elementor\Controls_Manager;
use Elementor\Repeater;

if (!defined('ABSPATH')) exit;

class Steps_Grid extends Widget_Base {
    public function get_name() { return 'wf-steps-grid'; }
    public function get_title() { return 'WevyFlow Steps Grid'; }
    public function get_icon() { return 'eicon-number-field'; }
    public function get_categories() { return ['wevyflow']; }

    protected function register_controls() {
        $this->start_controls_section('header_section', ['label' => 'Cabecalho']);
        $this->add_control('number', ['label' => 'Numero', 'type' => Controls_Manager::TEXT, 'default' => '02']);
        $this->add_control('label', ['label' => 'Label', 'type' => Controls_Manager::TEXT, 'default' => 'O metodo']);
        $this->add_control('heading', ['label' => 'Titulo', 'type' => Controls_Manager::TEXTAREA, 'default' => 'Tres passos para transformar leitura em renda']);
        $this->add_control('subtitle', ['label' => 'Subtitulo', 'type' => Controls_Manager::TEXTAREA, 'default' => 'Um sistema simples, testado e replicavel que qualquer leitor pode aplicar.']);
        $this->add_control('dark_mode', ['label' => 'Modo escuro', 'type' => Controls_Manager::SWITCHER, 'default' => 'yes']);
        $this->end_controls_section();

        $this->start_controls_section('steps_section', ['label' => 'Steps']);
        $repeater = new Repeater();
        $repeater->add_control('tag', ['label' => 'Tag', 'type' => Controls_Manager::TEXT, 'default' => 'Passo 01']);
        $repeater->add_control('title', ['label' => 'Titulo', 'type' => Controls_Manager::TEXT, 'default' => 'Titulo do passo']);
        $repeater->add_control('description', ['label' => 'Descricao', 'type' => Controls_Manager::TEXTAREA, 'default' => 'Descricao do passo.']);
        $repeater->add_control('is_hero', ['label' => 'Card destaque', 'type' => Controls_Manager::SWITCHER, 'default' => '']);
        $this->add_control('steps', [
            'label' => 'Steps',
            'type' => Controls_Manager::REPEATER,
            'fields' => $repeater->get_controls(),
            'default' => [
                ['tag' => 'Passo 01', 'title' => 'Leia com intencao', 'description' => 'Aprenda a extrair as ideias mais valiosas de qualquer livro em minutos.', 'is_hero' => ''],
                ['tag' => 'Passo 02', 'title' => 'Transforme em conteudo', 'description' => 'Converta insights em posts e conteudos que atraem audiencia qualificada.', 'is_hero' => ''],
                ['tag' => 'Resultado', 'title' => 'Monetize', 'description' => 'Use sua autoridade construida para vender produtos, mentorias e servicos.', 'is_hero' => 'yes'],
            ],
            'title_field' => '{{{ title }}}',
        ]);
        $this->end_controls_section();
    }

    protected function render() {
        $s = $this->get_settings_for_display();
        $dark = ($s['dark_mode'] ?? '') === 'yes';
        ?>
        <div class="wf-block<?php echo $dark ? ' wf-block--dark' : ''; ?>">
            <div class="wf-content">
                <div class="wf-wrap">
                    <div class="wf-shead wf-rv">
                        <div class="wf-label"><span class="wf-num"><?php echo esc_html($s['number']); ?></span> <?php echo esc_html($s['label']); ?></div>
                        <h2 class="wf-h2"><?php echo esc_html($s['heading']); ?></h2>
                        <p class="wf-body"><?php echo esc_html($s['subtitle']); ?></p>
                    </div>
                    <div class="wf-steps-grid wf-rv">
                        <?php foreach ($s['steps'] as $i => $step):
                            $hero = $step['is_hero'] === 'yes';
                        ?>
                        <div class="wf-step<?php echo $hero ? ' wf-step--hero' : ''; ?>">
                            <span class="wf-step-num"><?php echo $i + 1; ?></span>
                            <span class="wf-step-tag"><?php echo esc_html($step['tag']); ?></span>
                            <h3><?php echo esc_html($step['title']); ?></h3>
                            <p><?php echo esc_html($step['description']); ?></p>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }
}
